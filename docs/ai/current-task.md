# AI 当前任务（docs/ai/current-task）

## 当前阶段：M0.7（引擎与资源基础设施）

目标：完成可运行后端闭环，并打通 Chromium/GeoIP 资源统一下载入口。

## 本轮已完成

- [x] 新增 `proxies` / `profile_proxy_bindings` 实体与迁移
- [x] 新增 `services/proxy_service`：代理创建、列表、软删除、恢复
- [x] 新增 Profile 与 Proxy 绑定命令：绑定、解绑、查询当前绑定
- [x] `state` 注入 `proxy_service`，`lib` 注册 proxy 相关 tauri commands

## 当前验收

- [x] `cargo check --manifest-path src-tauri/Cargo.toml`
- [x] `pnpm build`

## 下一步（M0.8）

- [x] 前端信息架构拆分：总览/设置独立页面，菜单按页面组件拆分
- [x] 分组功能补齐：新增分组菜单页与基础交互
- [x] 分组后端持久化：`profile_groups` 表 + Tauri 命令 + 前端调用接入
- [x] 为 Profile 列表增加分页/筛选参数（含 include_deleted）
- [x] 为 Proxy 列表增加分页/筛选参数（协议、状态、地区）
- [x] 增加单元测试：SQLite 内存初始化 + 迁移、Profile/Proxy 分页筛选、Proxy 绑定一致性
- [x] 补全测试：Profile 生命周期闭环（open/close/delete/restore + engine guard）
- [x] 增加资源服务：统一清单（内置 + 可选远端 manifest）与资源下载命令
- [x] 将 Chromium 下载后的“安装/挂载/提取 + 可执行路径切换”自动化（macOS）
- [x] 完善 sidecar 启动参数注入（语言、地理位置、代理、WebRTC 等）并与 Profile/Proxy/GeoIP 配置联动

## 下一步（M0.9）

- [x] 前端环境页接入真实 Profile 列表与操作（open/close/delete/restore）
- [x] 环境创建按钮与创建页面（列表页 -> 创建页）
- [x] 前端代理页接入真实 Proxy 列表与绑定关系管理
- [x] 环境页新增“完整创建配置”交互（基础/指纹/代理/高级），并持久化到 Profile settings
- [x] 环境配置中的 `browserVersion` 启动联动：优先按环境版本解析可执行文件，未配置时回退 active version
- [x] 启动前浏览器可用性校验（无 active Chromium 时阻止启动并给出设置页引导）
- [x] 设置页增加 Chromium 版本管理（下载安装激活 / 切换 active version）
- [x] 新增窗口管理页面：对运行环境进行单个/批量标签页与窗口管理（前端页面 + Tauri 命令）
- [x] 窗口管理能力与自研 Chromium 文档语义对齐（close_inactive_tabs / activate_tab / activate_tab_by_index）
- [x] 窗口/标签页控制改为真实 Chromium `magic-socket-server-port` HTTP 通道（不再仅内存模拟）
- [x] 新增窗口尺寸管理能力：后端接入 `set_bounds`，前端窗口管理页支持设置 x/y/width/height
- [x] 窗口管理状态同步增强：拉取窗口列表前执行 runtime reconcile，并清理已退出会话
- [x] 标签页误操作防护：前端同环境窗口操作串行锁 + 操作后短延迟二次刷新
- [x] 新增回收站页面（设置页二级入口，非主导航），统一恢复已归档环境/代理/分组
- [x] 回收站数据策略明确：沿用现有软删除，不迁移关联数据结构；恢复时按原关系就地生效
- [x] 设置页增加机型映射管理（数据库单源：预设列表/新增/修改），并让环境创建/展示/启动统一走同一预设来源

## 当前进行中（前端结构重构）

- [ ] 前端 FSD 重构收尾：继续压缩控制台壳，只保留路由与装配职责
- [x] `profile / proxy / resource / group / window-session` 查询与写操作已迁到 `entities/*` 与 `features/*`
- [x] `console api / console utils / console pages / console types` 已删除
- [x] `console constants` 已拆分到主题预设、导航项、示例 section
- [ ] 继续清理 `use-console-state` 的剩余壳层编排，并评估是否进一步拆分 `ConsolePageContent`
