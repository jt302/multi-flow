# AI 会话摘要（docs/ai/session-summary）

- 目标：对标 AdsPower 功能面，生成 README 与核心文档，并给出分阶段落地路线。
- 已知：项目使用 Tauri + React + shadcn + Tailwind；浏览器引擎是自研/魔改 Chromium 144。
- 架构决策更新（2026-03-07）：后端持久化统一为 `SQLite + SeaORM`，不再以 JSON 作为长期方案。
- 当前进度：Profile 与 Proxy 基础模型均已迁移到 SeaORM，包含启动迁移与历史 JSON 一次性导入（Profile）。
- 当前优先：推进分页筛选、集成测试、引擎真实进程管理与 Local API/MCP。

## 2026-03-23

- 本轮已彻底移除内置会话自动化模块：
  - 删除前后端入口、页面、状态、命令、运行时模块与数据实体引用
  - 新增迁移删除历史会话自动化相关表
- 保留并收口的全局 UI 调整：
  - `WorkspaceTopbar` 左侧已改为“菜单展开/收起图标 + 当前页面 title/description”
  - `PageHeader` 已改为 actions-only：无 actions 时不渲染，有 actions 时只保留页面内右对齐操作行
  - 工作区外层与主内容区的 padding 已统一收紧，顶部工具栏外层 card 上下边距同步缩小

## 2026-03-07（本轮）

- 完成 Tauri 后端 M0 第一版：
  - 新增 `commands / services / engine_manager / local_api_server / state` 分层结构。
  - 落地 Profile 生命周期命令：创建、列表、打开、关闭、软删除、恢复。
  - 批量开关命令返回逐项结果和失败原因，满足“可观测”要求。
- 关键决策：
  - `commands` 仅做编排，业务落在 `services`，与协作规范一致。
  - Local API 当前仅做模块与状态占位，不在 M0 启动真实 HTTP 服务。
  - Local API 默认地址固定为 `127.0.0.1:18180`，避免默认对外暴露。
- 本轮新增：
  - 新增代理数据表：`proxies`、`profile_proxy_bindings`（含索引与 FK）。
  - 新增代理命令：`create/list/delete/restore` 与 `bind/unbind/get_profile_proxy`。
  - 删除代理时自动清理绑定，防止环境引用软删除代理。
  - `list_profiles` / `list_proxies` 已支持分页与筛选（page/page_size + 业务过滤项）。
  - 新增后端单元测试 3 个：分页筛选、绑定一致性、内存 DB 迁移链路。
  - 新增命令层闭环测试：`open -> close -> delete -> restore -> open`，并验证 delete 时 engine session 自动清理。
  - `engine_manager` 新增 sidecar 预接入：若检测到 Chromium 可执行文件则按 profile 启动子进程，否则自动回退 mock 模式。
  - 新增资源基础设施：`list_resources/download_resource` 命令，统一 Chromium/GeoIP 下载入口，并支持远端 manifest 回退内置配置。
  - 资源链路升级：新增 `install_chromium_resource` 与 `activate_chromium_version`，macOS 下支持 dmg 挂载安装并切换 active version。
  - 新增分组持久化：`profile_groups` 迁移、group commands/service，前端分组页接入后端数据。
  - 前端结构重构：菜单改为页面级拆分，总览与主题设置按功能独立，不再在每个菜单重复出现。
  - 前端环境页接入后端：支持真实 Profile 列表、创建、打开、关闭、删除、恢复；新增“创建环境”独立页面。
  - 前端代理页接入后端：支持真实 Proxy 列表、新增代理、删除/恢复代理、环境与代理绑定/解绑。
  - 前端通知接入 Sonner：全局 `Toaster` 已挂载，分组/环境/代理关键操作统一成功与失败提示。
  - 环境启动改为真实引擎模式：`open_profile` 启动前校验 active Chromium，缺失时返回明确错误并阻止 mock 启动。
  - 支持多版本切换生效：启动时动态读取当前 active Chromium 可执行文件，不再依赖应用启动时的固定路径。
  - 设置页新增 Chromium 版本管理 UI：支持资源刷新、下载并激活、已安装版本切换。
  - 资源下载进度事件：后端 `install_chromium_resource` 通过 Tauri 事件推送下载/安装阶段进度，前端用 Sonner 实时更新通知。
  - 环境启动防抖：前端对单环境启动/关闭动作增加锁，防止快速连点触发重复请求。
  - `open_profile` 启动链路新增参数解析与注入：语言、时区、WebRTC、代理、GeoIP 路径；支持可选 `OpenProfileOptions`。
  - 启动参数默认联动：读取 Profile 当前绑定代理自动注入 `--proxy-server`，并在代理场景默认启用 `disable_non_proxied_udp`。
  - 代理语言 / 时区默认值升级：代理可分别配置 `ip/custom` 来源；检测保留 `suggestedLanguage / suggestedTimezone` 作为建议值，并新增 `effectiveLanguage / effectiveTimezone` 作为环境继承和 Chromium 启动的实际默认值。
  - 新增 Profile 完整配置持久化：`profiles.settings_json`，支持基础设置/指纹设置/高级设置。
  - 新建环境页面升级为分区配置：基础设置、指纹配置、代理配置、高级设置。
  - 创建环境支持直接绑定代理，启动时自动合并 Profile 默认配置与运行时覆盖参数。
  - 启动浏览器版本联动增强：若环境配置了 `browserVersion`，启动时优先使用该版本可执行文件，否则回退全局 active version。
  - 新增窗口管理能力：`engine_manager` 维护运行会话的窗口/标签页状态，并新增单个/批量窗口管理 Tauri commands。
  - 窗口管理命令语义已对齐 `docs/ai/chromium.md`：支持 `open_new_tab/open_new_window/close_tab/close_inactive_tabs/activate_tab/activate_tab_by_index` 对应能力。
  - Chromium 启动参数新增 `--magic-socket-server-port` 注入；窗口与标签操作优先走 magic HTTP 实时控制。
  - 窗口状态列表改为实时读取 `get_browsers`，并新增窗口尺寸控制命令 `set_bounds`（前端可设置 x/y/width/height）。
  - 窗口列表查询前增加 runtime reconcile（包含进程存活校验），并在 `list_window_states` 前先清理已退出会话，减少运行状态滞后。
  - 前端窗口操作增加“同 profile 串行锁 + 二次刷新确认”，避免标签页操作延迟时重复点击导致误操作。
  - 前端结构重构继续收口：`WorkspaceLayout` 不再集中持有 profile/proxy/resource/window 全量状态，改为各路由页就近组合 query 与 action，控制台壳只保留导航、主题与页面装配。
  - 新增回收站：作为设置页二级入口（隐藏于主导航之外），集中展示并恢复 `deleted` 的 Profile/Proxy/Group。
  - 设置页新增“机型映射”管理：统一展示并编辑数据库中的设备预设，点击“新建机型”只重置表单，点击保存后才写入数据库。
  - 新增 `device_presets` 表与 `device_preset_service`，应用会把 catalog 默认预设 seed 到数据库，环境创建、详情展示和启动解析统一改为读取数据库中的同一套预设。
  - 启动链路、预览链路、环境保存时的 snapshot 解析都改为通过设备预设服务取 preset，再生成最终强关联指纹。
  - 设置页布局调整为单列：主题定制上移到顶部，移除与顶部工具栏重复的“主题模式”卡片。
  - 数据策略：继续采用软删除与 `deleted_at/lifecycle`，不做额外迁移；关联数据保持原样，恢复时直接复用原关系。
  - 前端新增“窗口管理”页面，支持对已打开环境执行批量新标签、批量新窗口、批量聚焦、批量关闭当前标签。
  - 新增命令层单测：代理默认参数推导、地理位置参数范围校验。
- 已知缺口：
  - `engine_manager` 已支持启动参数注入，但“地理位置精确覆盖（lat/lng）”仍待后续接入 CDP override（当前为参数校验与预留传递）。
  - 尚未推送 Tauri events 到前端。

## 2026-03-21（移除 RPA 相关功能）

- 按“彻底移除”目标删除 RPA 前端入口：
  - 删除 `RPA` 主导航、`/rpa*` 路由、独立编辑窗口与相关 query/action/store
  - 回收站不再展示或操作 RPA 流程
- 删除 RPA 后端运行链路：
  - 移除 `commands/rpa_commands`、`services/rpa_*`、`rpa_scheduler`
  - `AppState` 与应用启动阶段不再初始化、恢复或调度任何 RPA 运行态
- 数据与本地产物清理：
  - 新增 `m20260321_000014_drop_rpa_tables`，升级时删除历史 `rpa_*` 表
  - 启动时清理遗留 `rpa-artifacts` 目录
- 文档同步：
  - `docs/ai` 与工作台相关文案已移除把 RPA 视为当前产品能力的表述

## 2026-03-13（窗口同步按新协议重构）

- 同步架构切换为“前端直连 `sync-manager` sidecar”：
  - Tauri bundle 已注册 `binaries/sync-manager`
  - 后端只保留 sidecar 生命周期与本地实例快照，不再桥接业务 WebSocket 请求
  - 新增 `ensure_sync_sidecar_started`，保证 sidecar lazy 启动且幂等
- 前端新增全局单例同步客户端：
  - 新增 `MultiFlowSyncManagerClient + sync-manager-store`
  - 全应用只保留一条到 sidecar 的 WebSocket 连接
  - 统一维护实例表、当前 session payload、recent warnings、diagnostics 状态
- sidecar 协议消费与页面行为对齐 `multi-flow-sync-manager.md`：
  - 使用 `instances.upsert / instances.remove / instances.probe / sync.start / sync.stop / sync.get_session / sync.shutdown`
  - 主动消费 `instances.updated / sync.session_updated / sync.warning`
  - 实例首次出现、进入同步页、收到带 `instance_id` 的 warning 时都会触发 probe
- Tauri 同步命令收缩为本地增强能力：
  - 保留 `list_sync_targets / broadcast_sync_text / list_display_monitors / arrange_profile_windows / batch_restore_profile_windows / batch_set_profile_window_bounds`
  - 删除 `start_window_sync / stop_window_sync / restart_window_sync`
  - `broadcast_sync_text` 改为显式接收 `profileIds`
- `/windows` 页面升级为双数据源同步页：
  - 本地数据源来自 `list_sync_targets`，只返回运行环境快照和 `magicSocketServerPort`
  - sidecar 数据源来自全局 store，补齐 `status / platform / ws_status_verified / last_probe_error / last_drop_reason / active_browser / session role / bound_browser_id / bound_window_token / coordinate_mode`
  - 默认第一个选中的运行环境为主控，用户手动修改后保持
- 启动同步当前以最小页面约束为主：
  - 必须是 `1 master + 至少 1 slave`
  - 页面层只要求 `sync-manager` 已连接
  - 真实准入、probe 与失败原因统一以下游 `sync.start` / Chromium `get_sync_status` 为准
- UI 与交互更新：
  - 移除键盘 / 鼠标独立开关，完全按 sidecar 原生会话基线执行同步
  - 文本输入只对当前 sidecar session 的 `slave_ids` 生效
  - 新增同步诊断面板，显示连接状态、session 状态、metrics、recent probe errors、绑定窗口状态；页面不再显示 recent warnings 模块
- 2026-03-14 补充：
  - 项目内 `src-tauri/binaries/sync-manager-aarch64-apple-darwin` 已刷新为最新 sidecar 产物
  - `sync-manager` 转发 `sync.inject_event` 时改写为各自 slave 的 `browser_id / window_token`
  - mac `window_x / window_y` 语义统一为浏览器窗口左上角原点
  - mac slave 注入链已改为 responder 基线：
    - 键盘优先经 `performKeyEquivalent:` / `firstResponder keyDown:/keyUp:/flagsChanged:`
    - 鼠标优先经 `contentView mouseDown:/mouseUp:/mouseDragged:/mouseMoved:/scrollWheel:`
  - mac 注入期间临时 donor 了 `pressedMouseButtons / mouseLocation / currentEvent`，用于补齐 click / DOM 事件链需要的原生上下文
  - `sync-manager` 内部事件路由已从 `session.rs` 抽到独立 routing 模块
  - Tauri 前端同步 store 已拆分出独立 `sync-manager-client` 与 `sync-manager-normalizers`
  - sidecar 启动前校验已放宽为“平台一致 + 关键字段存在”，不再因主从窗口位置、尺寸、标签数或最大化状态不同而阻止 `sync.start`
- Rust 侧已删除旧 `window_sync_service` 会话镜像，避免与 sidecar session 真相源重复维护
