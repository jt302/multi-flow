# AI 当前任务（docs/ai/current-task）

## 当前里程碑：M0（后端先闭环）

目标：先完成“能跑起来 + 能创建/打开/关闭/恢复环境”的 Rust/Tauri 后端闭环，不引入云端能力。

### 已完成

- [x] 建立后端分层骨架（`commands / services / engine_manager / local_api_server / state`）
- [x] 完成 Profile 本地持久化（`profiles.json`）
- [x] 完成 Profile 基础生命周期命令：
  - [x] `create_profile`
  - [x] `list_profiles`
  - [x] `open_profile`
  - [x] `close_profile`
  - [x] `delete_profile`（软删除）
  - [x] `restore_profile`
- [x] 完成批量开关环境命令（返回每个 profile 的成功/失败原因）
- [x] Local API 模块化占位，且仅使用 `127.0.0.1` 地址

### 待完成（M0 剩余）

- [ ] 将 `engine_manager` 从模拟会话切换到真实 sidecar Chromium 进程管理
- [ ] 增加环境恢复策略（应用重启后识别并修正运行态）
- [ ] 增加基于事件的状态推送（open/close/delete/restore 的实时事件）

## 验收口径（最小可复现）

1. 在项目根目录执行：`pnpm tauri dev`
2. 前端调用 `create_profile` 创建 2 个环境，确认返回 `pf_******` ID
3. 调用 `open_profile` 打开其中 1 个环境，再调用 `list_profiles`，确认该环境 `running=true`
4. 调用 `close_profile` 后再次查询，确认 `running=false`
5. 调用 `delete_profile` 后默认 `list_profiles` 不再返回该环境
6. 调用 `restore_profile` 后再次查询，确认环境恢复为 `active`
7. 调用 `batch_open_profiles` / `batch_close_profiles`，确认返回包含 `success_count / failed_count / items[].message`
