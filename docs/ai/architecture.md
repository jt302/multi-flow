# AI 快速架构上下文（docs/ai/architecture）

## 1) 当前架构决策（已确认）

- Desktop：Tauri（Rust）
- UI：React + React Router + shadcn/ui + lucide-react + Tailwind CSS
- Browser Engine：自研/魔改 Chromium 144
- Storage：SQLite
- ORM：SeaORM（含 SeaORM Migration）

> 说明：从当前 `profiles.json` 过渡到 `SQLite + SeaORM` 是明确路线，后续文档与实现以此为准。

## 2) 核心抽象

- Profile（环境）：独立 user-data-dir，隔离 cookie/缓存/扩展
- Engine Session（运行态）：Profile 与 Chromium 进程/端口的映射
- Proxy（代理资产）：代理配置、健康状态、绑定关系
- Profile Settings（环境配置）：基础设置/指纹配置/代理配置/高级启动参数
- Fingerprint Source（指纹来源层）：`platform / devicePresetId / browserVersion / strategy / seedPolicy`
- Fingerprint Snapshot（指纹快照层）：最终实际注入给 Chromium 的完整强关联参数集合
- Host Resource（宿主资源层）：根据当前宿主系统解析可运行的 Chromium 资源版本，不参与模拟平台选择

## 3) Tauri 后端分层（目标）

- `commands/*`：Tauri command 入参校验、调用应用服务、错误映射
- `application/*`：用例编排（profile lifecycle、batch open/close、local api status）
- `domain/*`：领域模型与规则（Profile 生命周期、状态机、校验）
- `infra/db/*`：SeaORM 数据访问（Entity / ActiveModel / Repository）
- `infra/migration/*`：SeaORM migration（建表、索引、版本升级）
- `engine_manager/*`：引擎会话管理与 sidecar 调度
- `local_api_server/*`：本地 API（127.0.0.1）与鉴权/日志

## 4) 数据层规范（SQLite + SeaORM）

- 连接：应用启动时创建/注入 `DatabaseConnection`
- 迁移：启动阶段执行 `Migrator::up(db, None)`，保证 schema 一致
- 表设计（M0-M1 最小集）：
  - `profiles`
  - `profile_groups`
  - `proxies`
  - `profile_proxy_bindings`
  - `engine_sessions`
  - `device_presets`
  - `profiles.settings_json`（Profile 创建时完整配置持久化）
- 约束：
  - 软删除字段统一 `deleted_at`
  - 列表查询统一分页/排序字段
  - 所有写操作记录 `created_at/updated_at`

## 5) 当前代码状态（2026-03-07）

- 已有：
  - `commands/group_commands`（分组创建/列表/更新/删除/恢复）
  - `commands/profile_commands`
  - `commands/proxy_commands`
  - `commands/resource_commands`（资源列表/下载/安装/激活）
  - `services/profile_group_service`（分组持久化、重命名与 profile 计数）
  - `services/profile_service`（已基于 SeaORM）
  - `services/device_preset_service`（设备预设数据库服务，负责预设 seed、列表、编辑、解析）
  - `services/proxy_service`（已基于 SeaORM）
  - `services/engine_session_service`（运行会话持久化，记录 session_id/pid）
  - `services/resource_service`（统一资源清单、下载、Chromium 安装与版本激活）
  - `engine_manager`（支持 active Chromium 可执行文件探测、启动参数注入与 mock 回退）
  - `runtime_guard`（后台巡检运行态，自动回收崩溃进程与纠正 running 状态）
  - `local_api_server`
  - `db`（SQLite 连接 + migrator + profile/group/proxy/binding/engine_session entities）
- 当前持久化：`app_local_data_dir/multi-flow.sqlite3`
- 兼容策略：若检测到历史 `profiles.json` 且数据库为空，启动时执行一次性导入。
  - 启动参数联动（M0.8）：
  - `open_profile` 支持可选 `OpenProfileOptions`（语言、时区、默认打开 URL 列表、地理位置、WebRTC、headless、禁图、附加启动参数、运行时 seed）
  - `ProfileBasicSettings.startupUrls` 支持多个默认打开 URL；启动时会按列表顺序直接追加到 Chromium 启动参数中
  - `OpenProfileOptions` 不再承载 `UA / CPU / RAM / 字体` 这类强关联指纹覆盖；这组参数统一由 `fingerprintSnapshot` 生成
  - 自动读取 Profile 绑定代理并注入 `--proxy-server`
  - 若 Profile 保存了默认启动配置，启动时先加载默认配置，再叠加运行时传入参数
  - 若存在 GeoIP 资源文件则注入 `--geoip-database`
  - Profile 指纹配置已升级为 `source + snapshot`：

- 分组语义（当前实现）：
  - 环境仍保存 `group_name` 字符串，不引入 `group_id` 外键绑定
  - 分组删除后，所有关联环境的 `group_name` 会被直接清空
  - 分组恢复仅恢复分组实体本身，不自动恢复历史环境绑定
  - 分组重命名会同步更新关联环境的 `group_name`
    - `fingerprintSource` 记录模拟平台、设备预设、浏览器版本、策略与 seed policy
    - `fingerprintSnapshot` 记录 UA、UA metadata、平台参数、GL、CPU、RAM、字体、窗口尺寸、DPR、seed 等最终结果
    - 上层意图字段额外保留 `fontListMode`：
      - `preset`：使用当前平台默认字体池
      - `random`：按当前平台字体池稳定随机生成
      - `custom`：用户自定义字体列表，保存/预览/启动统一生效
    - 保存环境时强制写入 `source + snapshot`
    - 启动环境时按 `source` 与当前 seed 解析运行态 snapshot，再统一映射为 Chromium 参数
    - 历史平铺字段（如 `userAgent/customCpuCores/customRamGb/customFontList`）仅保留兼容读取与旧数据懒迁移，不再作为主写入或主校验来源
  - 浏览器版本只保留一个用户可见字段 `browserVersion`，同时参与：
    - 运行内核版本
    - 对外指纹版本
  - 宿主资源平台与模拟平台已经拆开：
    - 宿主资源平台由当前系统自动推导，仅用于过滤可运行资源和下载正确构建
    - 模拟平台由环境配置决定，可在 macOS 上模拟 `ios/android/windows/linux`
  - 指纹模板目录（fingerprint catalog）当前内置桌面 + 移动预设：
    - 桌面：`MacBook Pro 14`、`Windows 11 Desktop`、`Ubuntu Desktop`
    - 移动：`Pixel 8`、`Galaxy S24 Ultra`、`iPhone 15 Pro`、`iPhone 15 Pro Max`、`iPad Air`
    - 当前模板输出的 `custom-ram-gb` 统一限制为不超过 `8 GB`
  - 设备预设当前采用“数据库单源模型”：
    - 应用启动后由 `device_preset_service` 将 catalog 默认预设 seed 到 `device_presets` 表
    - 环境创建页、环境列表显示和启动时的 snapshot 解析统一走 `device_preset_service`
    - 设置页“机型映射”编辑的就是数据库中的同一份数据；点击“新建机型”只重置表单，点击保存后才真正写库
  - 后端会从 snapshot 统一注入：
    - `--custom-platform`
    - `--custom-ua-metadata`
    - `--custom-touch-points`
    - `--custom-gl-vendor`
    - `--custom-gl-renderer`
    - `--custom-cpu-cores`
    - `--custom-ram-gb`
    - `--custom-font-list`
    - `--window-size`
    - `--force-device-scale-factor`
    - `--fingerprint-seed`
    - 移动端补 `--use-mobile-user-agent`、`--touch-events=enabled`
  - 每个环境目录除 `user-data` 外，额外创建 `cache-data` 并注入独立 `--disk-cache-dir`
  - 默认在代理场景启用 WebRTC `disable_non_proxied_udp` 策略
  - 启动时按当前宿主系统 + `browserVersion` 解析资源：
    - 已安装则直接启动
    - 未安装则自动下载并安装该版本后继续启动
    - 不切换全局 active Chromium
    - 若当前系统无该版本构建，直接返回明确错误

## 6) 安全边界

- 当前不启用云端能力
- Local API 默认 `127.0.0.1:18180`
- 对外自动化能力（Local API/MCP）后续逐步开放，先保证本地最小权限与可审计
- 前端危险操作统一要求二次确认弹窗后再执行，例如删除、清空、批量 destructive 操作

## 7) 前端技术栈规范

- 前端目录当前按 FSD 收口：
  - `src/app`：应用入口、provider、router
  - `src/pages`：路由页面壳
  - `src/widgets`：页面级组合块与控制台壳
  - `src/features`：用户动作、表单、mutation 流程
  - `src/entities`：领域类型、query hooks、adapter、只读 UI
  - `src/shared`：跨域共享 API、lib、config、基础 hook
- 控制台壳当前只保留路由和装配职责：
  - `use-console-state` 负责组合 query 数据与各 feature action
  - 集中式 `console api / console utils / console pages / console types` 已移除
- 数据层统一走 `TanStack Query`：
  - 查询放在 `entities/*/model/use-xxx-query`
  - 写操作放在 `features/*/model/use-xxx-actions`
  - 页面层不再手写集中式 `Promise.all(refresh...)` 状态管理
- 本地 UI / 交互状态统一走 `Zustand`：
  - 仅存筛选、选中态、当前编辑对象、导航意图等本地状态
  - 不复制 `TanStack Query` 的服务端数据结果
  - 表单字段仍由 `react-hook-form + zod` 管理

- 组件库统一：`shadcn/ui`（基于 Radix + Tailwind），新组件优先复用 `src/components/ui/*`。
- 图标统一：`lucide-react`，新页面/新交互不再引入新的图标库依赖。
- 表单统一：所有“输入 + 提交”场景（创建、编辑、快捷修改、批量操作输入）必须使用 `react-hook-form`。
- 表单校验统一：`zod` + `@hookform/resolvers`（`zodResolver`）。
- 表单实现约束：
  - 表单状态、提交状态、错误状态统一由 RHF 管理，避免多套本地状态并存。
  - 校验 schema 与表单同模块维护（便于复用到创建/编辑场景）。
  - 提交前后端一致校验：前端做体验校验，后端做最终校验与兜底。
  - 页面与组件拆分约束：
  - `pages/*` 只负责路由装配与页面壳，不直接写请求细节。
  - 复用展示块优先拆到 `widgets/*`、`entities/*/ui`、`features/*/ui`。
  - 纯计算逻辑与展示格式化逻辑拆到对应实体或共享 `lib/*`。
  - 控制台页面默认采用懒加载，避免所有页面一次性打入首屏主包。
  - 环境创建页应优先暴露“上层意图”：平台、设备预设、浏览器版本、语言、时区、WebRTC、随机策略；强关联底层字段通过“指纹摘要”只读展示。
  - 设置页当前按“主题定制 / 运行资源 / 设备预设 / 维护入口”单列分区，设备预设管理应放在设置页，不再散落到环境创建页做底层强参数维护。
  - 前端页面读取环境指纹时，优先只消费 `fingerprintSource + fingerprintSnapshot`；历史平铺字段仅视为后端兼容输出，不作为页面主逻辑依赖。
