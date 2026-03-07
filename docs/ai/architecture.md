# AI 快速架构上下文（docs/ai/architecture）

你正在开发一个“类似 AdsPower”的桌面应用：

- Desktop：Tauri（Rust）作为系统核心与安全边界
- UI：React + shadcn/ui + Tailwind CSS
- Browser Engine：自研/魔改 Chromium（当前 144） 后续跟随chromium源码更新对应版本

核心抽象：Profile（环境）

- 每个 profile 对应一个独立 user-data-dir（cookie/缓存/扩展隔离）
- profile 启动时由 Engine Manager（sidecar）负责启动 Chromium 进程
- UI 通过 Tauri commands 调用 Rust，Rust 通过 events 推送状态

子系统：

- Proxy Pool：代理资产池与检测
- Extensions/App Center：团队扩展分发与上传
- Window Sync：窗口编排 + 输入同步 + 标签页批量（后续）
- RPA/RPA Plus：流程节点 + 任务化运行（后续）
- Local API & MCP：对外自动化接口（后续）
- Team/Permissions/Logs：团队治理（后续）

## 当前后端落地（M0）

- 代码分层：
  - `commands`：仅做参数接入、流程编排与错误转换
  - `services/profile_service`：Profile 业务与本地存储
  - `engine_manager`：环境运行态管理（当前为本地模拟会话）
  - `local_api_server`：本地 API 服务状态模块（当前仅状态占位）
- 持久化：
  - Profile 数据保存到 `app_local_data_dir/profiles.json`
  - 字段包含：`lifecycle(active/deleted)`、`running`、`deleted_at`、`last_opened_at`
- 当前可用命令（Tauri commands）：
  - `create_profile`
  - `list_profiles`
  - `open_profile`
  - `close_profile`
  - `delete_profile`（软删除）
  - `restore_profile`
  - `batch_open_profiles` / `batch_close_profiles`（返回逐项结果与失败原因）
  - `get_local_api_server_status`
- 安全边界：
  - 当前未启用任何云端能力
  - Local API 模块默认地址为 `127.0.0.1:18180`，尚未对外监听
