# AI 当前任务（docs/ai/current-task）

## 当前重点（2026-03-13）

- [x] 窗口同步模块按新 `chromium.md` / `multi-flow-sync-manager.md` 重构为“前端直连 sidecar”
- [x] 前端新增全局单例 `MultiFlowSyncManagerClient + Zustand store`，统一维护实例、会话、warnings、metrics
- [x] `sync-manager` 改为前端唯一 WebSocket 客户端消费 `instances.updated / sync.session_updated / sync.warning`
- [x] Tauri 只保留 sidecar 生命周期与本地实例快照职责：`ensure_sync_sidecar_started / list_sync_targets / broadcast_sync_text / list_display_monitors`
- [x] `/windows` 页面改为双数据源：本地运行环境快照 + sidecar 会话/诊断状态
- [x] 当前页面层“启动同步”仅要求 `sync-manager` 连接正常；真正的同步准入与失败原因统一以下游 `sync.start` / Chromium 诊断为准
- [x] 页面移除键盘/鼠标独立开关，文本输入仅对当前 sidecar session 的 `slave_ids` 生效
- [x] 新增同步诊断面板：sidecar 连接状态、session 状态、metrics、probe 错误；页面不再展示 warning 日志列表
- [x] 协议已对齐上游 Chromium / sync-manager：实例状态补齐 `bound_browser_id / bound_window_token / coordinate_mode`，同步 envelope 使用 `window_x / window_y`
- [x] 修正 slave 注入定位：sidecar 转发 `sync.inject_event` 时，按各自 slave 的绑定窗口改写 `browser_id / window_token`
- [x] 修正 mac 窗口坐标语义：`window_x / window_y` 统一为浏览器窗口左上角原点
- [x] 修正 mac 从机注入链：键盘改走 `performKeyEquivalent:/firstResponder keyDown:/keyUp:/flagsChanged:`，鼠标改走 `contentView` responder 链
- [x] 修正 mac 注入期 donor 语义：临时捐赠 `pressedMouseButtons / mouseLocation / currentEvent`
- [x] `sync-manager` 事件路由从 `session.rs` 抽离到独立 routing 模块，便于继续扩展 popup/child-window 规则
- [x] Tauri 同步 store 已拆分出 `sync-manager-client` 与 `sync-manager-normalizers`，减少单文件职责膨胀
- [x] 已更新项目内 `sync-manager` sidecar 二进制到最新版本；启动同步不再因主从 `bounds/maximized/minimized/fullscreen/tab_count` 不一致而被前置拒绝
- [x] 后端已删除旧 `window_sync_service` 会话镜像，避免与 sidecar 真相源重复维护

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
- [x] 新增窗口同步 sidecar 接入：`sync-manager` lazy 启动，Tauri 仅负责 sidecar 生命周期与本地实例快照
- [x] 窗口管理页面升级为“窗口同步”：支持多选环境、指定主控、启动/停止/重启同步
- [x] 同步配置区已补齐：窗口统一大小、显示窗口、按显示器宫格/重叠排列、文本输入广播
- [x] 同步真相源切换为 `sync-manager` sidecar session payload，并保留现有窗口/标签页明细控制
- [x] 标签页误操作防护：前端同环境窗口操作串行锁 + 操作后短延迟二次刷新
- [x] 新增回收站页面（设置页二级入口，非主导航），统一恢复已归档环境/代理/分组
- [x] 回收站数据策略明确：沿用现有软删除，不迁移关联数据结构；恢复时按原关系就地生效
- [x] 代理池页面仅显示 active 代理资产；已归档代理统一进入回收站处理
- [x] 回收站已补齐彻底删除入口：环境 / 代理 / 分组 均支持二次确认后永久删除
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

## 本轮新增（2026-03-21：移除 RPA 相关功能）

- [x] 删除前端 `RPA` 导航、`/rpa*` 路由、独立编辑窗口、数据层与相关测试/状态模块
- [x] 删除后端 RPA 命令、服务、调度器、运行态恢复逻辑与 `AppState` 中的 RPA 依赖
- [x] 新增迁移 `m20260321_000014_drop_rpa_tables`，升级时删除历史 `rpa_*` 表
- [x] 启动时清理遗留 `rpa-artifacts` 目录，避免保留失效调试产物
- [x] 文档、回收站描述与工作台文案已同步去除 RPA 能力表述

## 本轮新增（代理画像 + GEO 联动）

- [x] 代理检测改为真实出口检测：通过代理请求公网 IP，再用本地 GeoLite2 City 数据库回填国家 / 区域 / 城市 / 经纬度
- [x] 代理实体补齐画像字段：`checkStatus / checkMessage / exitIp / suggestedLanguage / suggestedTimezone / expiresAt`
- [x] 代理语言 / 时区配置升级为“来源 + 建议值 + 最终生效值”：分别支持 `ip/custom`，并新增 `effectiveLanguage / effectiveTimezone`
- [x] 新增 / 编辑代理不再手填国家、区域、城市；这些字段统一由检测自动维护
- [x] 代理列表改为多列细节展示：协议 / GEO / 出口 IP / 健康状态 / 过期时间 / 绑定环境数
- [x] 设置页资源管理增加 GEO 数据库状态与下载入口
- [x] 环境创建页选择代理后，自动带出代理最终生效的语言 / 时区与 GEO 经纬度，并允许用户手动覆盖

## 本轮新增（环境地理位置模式）

- [x] 环境高级设置新增地理位置模式：`off / ip / custom`
- [x] 环境高级设置新增“地理位置权限始终允许”开关，默认关闭
- [x] `ip` 模式启动时优先使用绑定代理 GEO，缺失时回退本机公网 IP 的本地 GeoIP 查询结果
- [x] `custom` 模式改为注入 Chromium 正式参数 `--custom-geolocation-*`
- [x] 启动链路支持 `--auto-allow-geolocation`，不再依赖内部 `--multi-flow-geolocation`

## 本轮新增（WebRTC 跟随 IP）

- [x] 环境指纹设置新增 WebRTC 模式 `follow_ip`，前端文案显示为“跟随 IP”
- [x] 新环境默认 WebRTC 策略改为“跟随 IP”，旧环境继续保持原保存值
- [x] `follow_ip` 模式启动时优先使用绑定代理 `exit_ip`，缺失时回退本机公网 IP
- [x] 若 `follow_ip` 无法解析目标 IP，则不阻塞启动并回退为不注入 `--webrtc-ip-override`

## 本轮新增（自定义分辨率参数）

- [x] 机型预设中的 `viewportWidth / viewportHeight / deviceScaleFactor` 统一作为默认分辨率参数
- [x] 环境创建/编辑页新增可编辑分辨率字段，初始值来自机型预设，切换预设时重置为新预设默认值
- [x] 环境分辨率修改仅保存到环境自身 `fingerprint settings`，不会回写机型预设
- [x] 运行态快照优先使用环境分辨率覆盖，缺失时回退机型预设默认值
- [x] 启动参数已切换为 `--custom-resolution-width/height/dpr`
- [x] 启动链路使用与 `custom-resolution` 同步的 `--window-size`，并继续停止注入 `--force-device-scale-factor`、`--geoip-database`
- [x] `--use-mobile-user-agent` 与 `--touch-events=enabled` 改为仅在移动机型预设下开启
