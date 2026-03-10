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
- [x] 代理池页面仅显示 active 代理资产；已归档代理统一进入回收站处理
- [x] 回收站已补齐彻底删除入口：环境 / 代理 / 分组 / RPA 流程 均支持二次确认后永久删除
- [x] 设置页增加机型映射管理（数据库单源：预设列表/新增/修改），并让环境创建/展示/启动统一走同一预设来源

## 当前进行中（前端结构重构）

- [x] 前端 FSD 重构收尾：控制台壳已压缩为 `WorkspaceLayout + src/pages/*`，页面各自读取 query / action
- [x] `profile / proxy / resource / group / window-session` 查询与写操作已迁到 `entities/*` 与 `features/*`
- [x] `console api / console utils / console pages / console types` 已删除
- [x] `console constants` 已拆分到主题预设、导航项、示例 section
- [x] 已移除 `ConsoleShell` 与 `use-console-state`，主页面改为 `AppRouter + WorkspaceLayout + src/pages/*`

## 本轮新增（分组闭环 + Zustand）

- [x] 前端本地 UI 状态开始统一到 `Zustand`，当前已覆盖：环境列表筛选/选择/快捷编辑/批量结果、分组页搜索与编辑目标、控制台环境导航意图
- [x] 分组后端补齐更新能力：`update_profile_group`
- [x] 环境后端补齐分组指派能力：`set_profile_group` / `batch_set_profile_group`
- [x] 删除分组后继续沿用当前语义：直接清空相关环境 `group_name`
- [x] 分组页补齐搜索 / 编辑 / 查看组内环境入口
- [x] 环境列表补齐单个与批量归组、清空分组
- [x] 环境创建/编辑页的分组字段改为真实分组列表选择，不再依赖纯文本建议
- [x] 环境页分组筛选已与 URL query 同步，刷新后保留当前分组筛选
- [x] 创建环境默认打开 URL 改为多值列表：前端一行一个，后端保存 `startupUrls`，启动时按顺序追加到 Chromium 参数

## 本轮新增（RPA v1 首版骨架）

- [x] 新增 RPA 数据模型与迁移：`rpa_flows` / `rpa_flow_targets` / `rpa_runs` / `rpa_run_instances` / `rpa_run_steps`
- [x] 新增 RPA 后端服务：流程 CRUD、任务创建、步骤日志、调试产物目录、实例状态推进
- [x] 新增 RPA Tauri 命令：流程 CRUD、运行流程、任务详情、步骤列表、取消、人工继续
- [x] `engine_manager` 新增运行句柄读取能力，RPA 可读取 `debug_port / magic_port`
- [x] `/rpa` 页面已收缩为 RPA 流程列表页，仅保留清单与新建入口
- [x] 新增独立 RPA 编辑窗口：流程设计、运行面板、任务中心迁移到单独窗口
- [x] 前端新增 `entities/rpa` 与 `features/rpa` 数据层、Zustand 选择状态、Tauri 事件增量刷新
- [x] RPA 归档策略接入现有回收站：`/rpa` 仅显示 active 流程，回收站新增 RPA 流程恢复与彻底删除
- [ ] 继续补强节点配置体验（当前节点配置仍以 JSON 为主）
- [ ] 继续补强页面自动化节点覆盖面与更细粒度的人工接管体验
- [x] 已拆分独立编辑页为页面容器 + `use-rpa-flow-editor` hook + 头部/设计面板/运行面板/离开弹窗组件

## 本轮新增（代理画像 + GEO 联动）

- [x] 代理检测改为真实出口检测：通过代理请求公网 IP，再用本地 GeoLite2 City 数据库回填国家 / 区域 / 城市 / 经纬度
- [x] 代理实体补齐画像字段：`checkStatus / checkMessage / exitIp / suggestedLanguage / suggestedTimezone / expiresAt`
- [x] 新增 / 编辑代理不再手填国家、区域、城市；这些字段统一由检测自动维护
- [x] 代理列表改为多列细节展示：协议 / GEO / 出口 IP / 健康状态 / 过期时间 / 绑定环境数
- [x] 设置页资源管理增加 GEO 数据库状态与下载入口
- [x] 环境创建页选择代理后，自动带出语言 / 时区 / 地理位置建议，并允许用户手动覆盖
