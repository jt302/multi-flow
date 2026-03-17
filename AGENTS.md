# Multi-Flow Agent 协作说明

## 1. 语言与沟通

- 默认使用中文回复与注释。
- 优先给出可执行结论，再补充必要原因。
- 发现阻塞（依赖缺失、命令失败、权限问题）要明确指出并给出替代方案。

## 2. 项目信息（必须了解）

- 项目名称：`multi-flow`
- 前端：`React + TypeScript + Vite + Tailwind + shadcn/ui + lucide-react + sonner + tanstack query + zustand`
- 前端：`所有输入+提交类表单统一使用 react-hook-form 配合 @hookform/resolvers + zod（zodResolver）校验`
- 后端：`Tauri v2 + Rust + SQLite + SeaORM`
- 浏览器引擎：自研 Chromium（当前资源以 macOS 版本为主）
- 资源下载：统一资源清单机制（内置 + 可选远端 manifest）

## 3. 基本工作规则

- 优先在现有架构上增量修改，不做无关重构。
- 若“实现与文档冲突”，以当前确认需求为准，并同步更新 `docs/ai` 对应文档，避免后续混乱。
- 功能开发完成后至少执行：
  - 前端：`pnpm -s build`
  - 后端：`cargo check --manifest-path src-tauri/Cargo.toml`
  - 有测试时：`cargo test --manifest-path src-tauri/Cargo.toml`
- 不使用破坏性 git 命令（如 `reset --hard`）处理问题。

## 4. 目录与职责（高频）

- 前端入口与路由：`src/app/*`、`src/pages/*`
- 页面级组合壳：`src/widgets/*`
- 业务动作与表单：`src/features/*`
- 领域实体、query、只读展示：`src/entities/*`
- 跨域共享能力：`src/shared/*`
- 通用组件：`src/components/*`
- Tauri 命令层：`src-tauri/src/commands/*`
- 领域/服务层：`src-tauri/src/services/*`
- 引擎会话管理：`src-tauri/src/engine_manager/*`
- 数据层（SeaORM）：`src-tauri/src/db/*`
- 运行态守护：`src-tauri/src/runtime_guard.rs`

## 5. 运行与调试提示

- 本地开发：`pnpm tauri dev`
- 若 Node 由 nvm 管理，确保当前 shell 已加载 nvm 环境后再运行命令。
- 资源相关问题先检查：
  - 设置页资源状态（下载/安装/激活）
  - 数据目录资源文件是否存在
  - 当前 active chromium 是否可执行

## 6. AI 文档索引

以下文档是本项目 AI 协作的主要上下文。开始实现前应先读取相关文档，提交变更后按需同步更新：

- [架构上下文](docs/ai/architecture.md)
- [自研 Chromium 相关说明](docs/ai/chromium.md)
- [当前任务清单](docs/ai/current-task.md)
- [项目背景与路线](docs/ai/project-context.md)
- [会话摘要与阶段记录](docs/ai/session-summary.md)
- [React 规则](docs/ai/react-rules.md)
- [component library 规则](docs/ai/component-library.md)
- [Proxy Daemon 用法说明](docs/ai/proxy-daemon.md)
- [自研 chromium 项目位置](/Users/tt/Developer/Personal/chromium)
- [sync-manger 项目位置](/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager)
- [tauri 日志文件位置](/Users/tt/Library/Application Support/com.tt.multi-flow/logs/backend.log)

## 7. 开发执行建议（简版）

- 新功能优先拆成：类型 -> API -> 状态管理 -> 页面组件 -> 后端命令 -> 服务层 -> 测试。
- 前端所有可点击控件保持 `cursor-pointer`。
- 页面按路由维度拆分，避免把多个功能堆在同一页面组件中。
- 批量操作必须返回成功/失败统计，便于调试与阶段性检查。
- 所有危险操作必须弹窗二次确认后再执行，例如删除、清空、批量 destructive 操作。
