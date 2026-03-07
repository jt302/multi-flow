# AI 会话摘要（docs/ai/session-summary）

- 目标：对标 AdsPower 功能面，生成 README 与核心文档，并给出分阶段落地路线。
- 已知：项目使用 Tauri + React + shadcn + Tailwind；浏览器引擎是自研/魔改 Chromium 144。
- 当前优先：先做 Profile 管理 + 引擎启动闭环 + 代理池 + 回收站，再逐步加入窗口同步、RPA、Local API/MCP、团队权限与日志。

## 2026-03-07（本轮）

- 完成 Tauri 后端 M0 第一版：
  - 新增 `commands / services / engine_manager / local_api_server / state` 分层结构。
  - 落地 Profile 生命周期命令：创建、列表、打开、关闭、软删除、恢复。
  - 批量开关命令返回逐项结果和失败原因，满足“可观测”要求。
- 关键决策：
  - `commands` 仅做编排，业务落在 `services`，与协作规范一致。
  - Local API 当前仅做模块与状态占位，不在 M0 启动真实 HTTP 服务。
  - Local API 默认地址固定为 `127.0.0.1:18180`，避免默认对外暴露。
- 已知缺口：
  - `engine_manager` 目前是会话模拟，尚未接入真实 Chromium sidecar 进程。
  - 尚未推送 Tauri events 到前端。
