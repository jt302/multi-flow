# AI Chat 自动化系统实现文档

> 最后更新: 2026-04-06
> 状态: **Phase 1-4 已完成，Phase 5 部分待续**

---

## 一、功能概述

在 Multi-Flow 现有自动化基础设施之上，新增一个 **AI 聊天页面**，允许用户通过自然语言与 AI Agent 实时对话，Agent 调用 147 个现有工具执行浏览器操控、数据管理等操作。

### 核心能力

| 能力                 | 说明                                                |
| -------------------- | --------------------------------------------------- |
| 自然语言驱动         | 用户输入指令，AI 自动调用工具完成任务               |
| 工具调用可视化       | 每次工具调用以可折叠卡片展示，含参数/结果/耗时/截图 |
| 多 Provider 支持     | 复用现有 8 个 LLM Provider 配置                     |
| 持久化历史           | 聊天记录存储在 SQLite，跨会话恢复                   |
| 全局/每聊天提示词    | 全局系统提示词 + 每聊天任务提示词                   |
| 停止/重新生成        | 可中断生成，可重新生成上一条回复                    |
| 保存为脚本（规划中） | 将对话转化为可复用的自动化脚本                      |

---

## 二、架构设计

### 2.1 整体架构

```
用户输入
  ↓
前端 AiChatPage
  ↓ tauriInvoke('send_chat_message')
后端 chat_commands::send_chat_message
  ↓
ChatExecutionService::send_message
  ├── ChatService::add_message()          → 保存用户消息 → DB
  ├── ChatService::build_ai_messages()    → 从 DB 构建历史
  ├── ai_prompts::build_chat_system_prompt()
  ├── ToolRegistry::definitions()          → 获取工具 Schema
  └── AiService::chat_with_tools() loop
        ├── 工具调用 → ToolRegistry::execute() → ChatService::add_message()
        ├── emit('ai_chat://message') → 前端实时更新
        ├── emit('ai_chat://phase')   → 前端状态指示
        ├── emit('ai_chat://session_updated') → 前端同步 active profile
        └── 文本回复 → ChatService::add_message() → done
```

### 2.1.1 当前工具目标环境规则

AI Chat 的浏览器工具目标环境使用统一解析规则：

1. `active_profile_id`
2. `profile_id`
3. `profile_ids` 第一个

`cdp_*` / `magic_*` 永远作用于当前工具目标环境。若一个会话关联多个环境，AI 必须先调用 `app_set_chat_active_profile(profile_id)` 再执行浏览器工具。`app_start_profile` 只负责启动环境，不会隐式切换当前工具目标环境。

### 2.2 数据库 Schema

```sql
-- 聊天会话
CREATE TABLE chat_sessions (
    id              TEXT PRIMARY KEY,
    title           TEXT,
    profile_id      TEXT,           -- 关联 Profile（可空）
    ai_config_id    TEXT,           -- AI 配置 ID
    system_prompt   TEXT,           -- 每聊天提示词
    tool_categories TEXT,           -- JSON: 启用的工具类别
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- 聊天消息
CREATE TABLE chat_messages (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    role            TEXT NOT NULL,   -- user | assistant | tool | system
    content_text    TEXT,
    content_json    TEXT,
    tool_calls_json TEXT,            -- assistant 的 tool_calls
    tool_call_id    TEXT,            -- tool result 关联的 call ID
    tool_name       TEXT,
    tool_args_json  TEXT,
    tool_result     TEXT,
    tool_status     TEXT,            -- completed | failed
    tool_duration_ms INTEGER,
    image_base64    TEXT,            -- 截图数据
    parent_id       TEXT,            -- 分支支持
    is_active       INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    sort_order      INTEGER NOT NULL
);
CREATE INDEX idx_chat_messages_session_order ON chat_messages(session_id, sort_order);
```

### 2.3 与现有系统的集成点

| 现有模块                 | 集成方式                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| `ai_service::AiService`  | 直接复用 `chat_with_tools()`                                      |
| `ai_tools::ToolRegistry` | 直接复用 `definitions()` + `execute()`                            |
| `ai_tools::ToolContext`  | 以 session_id 为 run_id 构建相同上下文，并补充 current_profile_id |
| `ai_prompts`             | 新增 `build_chat_system_prompt()`，去掉 submit_result 指令        |
| `app_preference_service` | 新增 `ai_chat_global_prompt` 字段                                 |
| `engine_manager`         | 通过 `get_runtime_handle()` 获取 debug_port/magic_port            |

---

## 三、已实现文件清单

### 3.1 后端（Rust）

| 文件                                                               | 状态    | 说明                                                        |
| ------------------------------------------------------------------ | ------- | ----------------------------------------------------------- |
| `src-tauri/src/db/migrator/m20260405_000027_create_chat_tables.rs` | ✅ 完成 | 创建 chat_sessions + chat_messages 表                       |
| `src-tauri/src/db/entities/chat_session.rs`                        | ✅ 完成 | SeaORM entity                                               |
| `src-tauri/src/db/entities/chat_message.rs`                        | ✅ 完成 | SeaORM entity                                               |
| `src-tauri/src/db/entities/mod.rs`                                 | ✅ 完成 | 注册新 entity                                               |
| `src-tauri/src/db/migrator/mod.rs`                                 | ✅ 完成 | 注册新迁移                                                  |
| `src-tauri/src/services/chat_service.rs`                           | ✅ 完成 | 会话/消息 CRUD + build_ai_messages()                        |
| `src-tauri/src/services/chat_execution_service.rs`                 | ✅ 完成 | Tool calling 循环核心引擎                                   |
| `src-tauri/src/services/ai_prompts.rs`                             | ✅ 完成 | 新增 build_chat_system_prompt() + build_chat_base_context() |
| `src-tauri/src/services/app_preference_service.rs`                 | ✅ 完成 | 新增 ai_chat_global_prompt 字段和读写方法                   |
| `src-tauri/src/services/mod.rs`                                    | ✅ 完成 | 注册 chat_service, chat_execution_service                   |
| `src-tauri/src/commands/chat_commands.rs`                          | ✅ 完成 | 10 个 Tauri 命令                                            |
| `src-tauri/src/commands/mod.rs`                                    | ✅ 完成 | 注册 chat_commands                                          |
| `src-tauri/src/state.rs`                                           | ✅ 完成 | AppState 新增 chat_service + chat_cancel_tokens             |
| `src-tauri/src/lib.rs`                                             | ✅ 完成 | 注册 10 个 chat 命令到 invoke_handler                       |

### 3.2 前端（TypeScript/React）

| 文件                                                      | 状态    | 说明                                             |
| --------------------------------------------------------- | ------- | ------------------------------------------------ |
| `src/entities/chat/model/types.ts`                        | ✅ 完成 | ChatSession, ChatMessageRecord 等类型            |
| `src/entities/chat/api/chat-api.ts`                       | ✅ 完成 | Tauri invoke 封装 + event 监听                   |
| `src/store/chat-store.ts`                                 | ✅ 完成 | Zustand store（实时状态管理）                    |
| `src/features/ai-chat/model/use-chat-sessions.ts`         | ✅ 完成 | TanStack Query hooks（会话 CRUD）                |
| `src/features/ai-chat/model/use-chat-messages.ts`         | ✅ 完成 | TanStack Query hooks（消息列表）                 |
| `src/features/ai-chat/ui/ai-chat-page.tsx`                | ✅ 完成 | 主页面（双面板布局 + event 监听 + 自动标题）     |
| `src/features/ai-chat/ui/chat-session-list.tsx`           | ✅ 完成 | 左面板：会话列表 + 新建/删除                     |
| `src/features/ai-chat/ui/chat-message-list.tsx`           | ✅ 完成 | 消息流（用户气泡/AI 卡片/工具卡片）              |
| `src/features/ai-chat/ui/chat-message-list-lightbox.css`  | ✅ 完成 | Lightbox 样式覆写（固定右上角按钮 + 预览外观）   |
| `src/features/ai-chat/ui/tool-call-card.tsx`              | ✅ 完成 | 可折叠工具调用展示（含截图内联）                 |
| `src/features/ai-chat/ui/chat-input-bar.tsx`              | ✅ 完成 | 输入框 + 发送/停止按钮                           |
| `src/features/ai-chat/ui/chat-header.tsx`                 | ✅ 完成 | 可编辑标题 + Profile/AI Config 选择 + 系统提示词 |
| `src/features/settings/ui/ai-chat-global-prompt-card.tsx` | ✅ 完成 | 全局 AI 聊天提示词设置卡片                       |
| `src/pages/ai-chat/index.tsx`                             | ✅ 完成 | 路由页面                                         |
| `src/shared/i18n/locales/zh-CN/chat.json`                 | ✅ 完成 | 中文 i18n                                        |
| `src/shared/i18n/locales/en-US/chat.json`                 | ✅ 完成 | 英文 i18n                                        |
| `src/shared/config/query-keys.ts`                         | ✅ 完成 | 新增 chatSessions + chatMessages keys            |
| `src/app/model/workspace-types.ts`                        | ✅ 完成 | NavId 新增 'ai-chat'                             |
| `src/app/workspace-routes.ts`                             | ✅ 完成 | NAV_PATHS 新增 '/ai-chat'                        |
| `src/app/model/workspace-nav-items.ts`                    | ✅ 完成 | 导航项新增 AI 助手（MessageSquare 图标）         |
| `src/app/model/workspace-sections.ts`                     | ✅ 完成 | 新增 'ai-chat' section                           |
| `src/app/router.tsx`                                      | ✅ 完成 | 新增 /ai-chat 路由                               |

### 3.3 新增依赖

| 包                           | 版本   | 用途                         |
| ---------------------------- | ------ | ---------------------------- |
| `react-markdown`             | latest | AI 回复 Markdown 渲染        |
| `remark-gfm`                 | latest | GFM 表格/删除线/链接支持     |
| `date-fns`                   | latest | 聊天列表时间格式化           |
| `yet-another-react-lightbox` | latest | 聊天图片预览、缩放与关闭交互 |

---

## 四、后端命令清单

| 命令                           | 类型  | 说明                                   |
| ------------------------------ | ----- | -------------------------------------- |
| `list_chat_sessions`           | sync  | 获取所有会话列表（按 updated_at 降序） |
| `create_chat_session`          | sync  | 创建新会话                             |
| `update_chat_session`          | sync  | 更新会话（标题/Profile/AI配置/提示词） |
| `delete_chat_session`          | sync  | 删除会话及其所有消息                   |
| `list_chat_messages`           | sync  | 获取会话的活跃消息列表                 |
| `send_chat_message`            | async | 发送消息并触发 AI tool calling 循环    |
| `stop_chat_generation`         | sync  | 设置取消标志，中断当前生成             |
| `regenerate_chat_message`      | async | 删除最后一条用户消息后的内容，重新生成 |
| `read_ai_chat_global_prompt`   | sync  | 读取全局聊天提示词                     |
| `update_ai_chat_global_prompt` | sync  | 保存全局聊天提示词                     |

---

## 五、Tauri 事件规范

| 事件名                      | Payload                                          | 触发时机                         |
| --------------------------- | ------------------------------------------------ | -------------------------------- |
| `ai_chat://message`         | `{ sessionId, message: ChatMessageRecord }`      | 每条消息保存到 DB 后             |
| `ai_chat://phase`           | `{ sessionId, phase, round, toolName?, error? }` | 每轮状态变化时                   |
| `ai_chat://session_updated` | `{ sessionId, session: ChatSession }`            | 会话 active profile 被后端改写时 |

**phase 取值：**

- `thinking` — AI 正在思考（等待 LLM 响应）
- `tool_calling` — AI 正在执行工具（toolName 非空）
- `done` — 本轮生成完成
- `error` — 发生错误（error 非空）

---

## 六、实现进度

### Phase 1: 后端基础 ✅ 完成

- [x] 数据库迁移（chat_sessions, chat_messages）
- [x] SeaORM entities
- [x] ChatService CRUD
- [x] build_chat_system_prompt() 提示词函数
- [x] ai_chat_global_prompt 偏好设置字段

### Phase 2: 核心执行引擎 ✅ 完成

- [x] ChatExecutionService tool calling 循环
- [x] chat_commands.rs 所有命令
- [x] lib.rs 命令注册
- [x] AppState 扩展
- [x] Tauri events 定义和发射

### Phase 3: 前端基础 ✅ 完成

- [x] entities/chat/ 类型和 API 层
- [x] store/chat-store.ts
- [x] 路由和导航集成
- [x] 依赖安装（react-markdown, remark-gfm, date-fns）

### Phase 4: 聊天 UI ✅ 完成

- [x] ai-chat-page.tsx 双面板布局
- [x] chat-session-list.tsx 会话管理
- [x] chat-message-list.tsx + 消息组件（用户/AI/工具）
- [x] chat-input-bar.tsx 输入交互
- [x] tool-call-card.tsx 工具调用可视化

### Phase 5: 高级功能 � 部分完成

| 功能                 | 优先级 | 状态    | 说明                                                              |
| -------------------- | ------ | ------- | ----------------------------------------------------------------- |
| 保存为脚本           | 高     | 🔲 待做 | `chat_to_script` 命令 + 前端预览对话框                            |
| 聊天标题自动生成     | 中     | ✅ 完成 | 首条消息前 30 字作为标题（ai-chat-page.tsx handleSend）           |
| i18n 完善            | 中     | ✅ 完成 | chat namespace 注册 + en-US/nav.json 补充 + 5 个组件去硬编码      |
| 设置页全局提示词入口 | 中     | ✅ 完成 | ai-chat-global-prompt-card.tsx + settings-page.tsx AI tab 集成    |
| chat-header.tsx      | 中     | ✅ 完成 | 可编辑标题 + Profile 选择器 + AI Config 选择器 + 可折叠系统提示词 |
| 后端日志修复         | 中     | ✅ 完成 | chat_service.rs build_ai_messages() JSON 解析失败改 warn 日志     |
| 测试修复             | 中     | ✅ 完成 | 3 个测试文件 AppState 补全 chat_service + chat_cancel_tokens      |
| 危险操作确认         | 低     | 🔲 待做 | 高风险工具执行前弹窗确认                                          |
| 对话分支 UI          | 低     | 🔲 待做 | 编辑历史消息创建分支                                              |
| 快捷模板             | 低     | 🔲 待做 | "/" 触发预设提示词                                                |
| 上下文窗口管理       | 低     | 🔲 待做 | Token 计数 + 滑动窗口                                             |
| 聊天导出             | 低     | 🔲 待做 | 导出 JSON 格式聊天记录                                            |

---

## 七、已完成的关键细节

### 7.1 en-US/nav.json 补充 ✅

已在 `src/shared/i18n/locales/en-US/nav.json` 添加 `"aiChat": "AI Chat"` 以及 `"aiChatSection"` 块。
同步在 `zh-CN/nav.json` 添加了 `"aiChatSection"` 块。

### 7.2 AI 助手首屏加载优化 ✅

- AI 助手页保留“记住上次会话”，但改为“会话列表先渲染，消息区延迟恢复”
- 页面不再直接用持久化 `activeSessionId` 挂载消息区，而是先等待会话列表加载完成，再通过 `requestAnimationFrame + startTransition` 恢复右侧会话内容
- Profile 选择器改为仅在下拉打开时请求环境列表，避免进入页面即触发额外 `list_profiles`
- 工具截图移除折叠态缩略图；展开后才加载图片，并统一补充图片懒加载属性，减少重截图会话的首屏阻塞

### 7.3 聊天图片预览改为现成 Lightbox ✅

- `chat-message-list.tsx` 不再维护自写的 `Dialog + 手动 zoom state`，统一改为 `yet-another-react-lightbox + Zoom` 插件
- 预览层保留右上角固定关闭按钮和背景点击关闭，同时把缩放、滚轮缩放、双击缩放交给库处理，减少自写交互瑕疵
- 通过 `className="ai-chat-lightbox"` 和专用 CSS 覆写按钮/图片外观，移除旧实现中的黑色边框感，并限制图片与窗口边缘保持安全留白

### 7.4 chat-header.tsx ✅

已创建 `src/features/ai-chat/ui/chat-header.tsx`，包含：

- 聊天标题（点击可编辑，Input + Pencil 图标切换）
- Profile 下拉选择器（显示运行中 Profile 绿色圆点）
- AI Config 下拉选择器（复用 listAiConfigs）
- 系统提示词展开/折叠面板（Textarea，blur 时自动保存）

已在 `ai-chat-page.tsx` 中集成渲染。

### 7.5 设置页全局提示词 ✅

已创建 `src/features/settings/ui/ai-chat-global-prompt-card.tsx`，在 settings-page.tsx AI tab 中集成，位于 AiProviderConfigCard 和 CaptchaSolverConfigCard 之间。

### 7.6 i18n chat namespace 注册 ✅

已在 `src/shared/i18n/index.ts` 注册 `chat` namespace。5 个聊天组件（ai-chat-page、chat-session-list、chat-message-list、chat-input-bar、tool-call-card）全部替换为 `useTranslation('chat')` + `t()` 调用。`workspace-sections.ts` 中 ai-chat section 也已改用 i18n。

### 7.7 后端日志修复 ✅

`chat_service.rs` 的 `build_ai_messages()` 在 `tool_calls_json` 解析失败时现在会通过 `crate::logger::warn()` 记录警告，而不是静默忽略。

### 7.6 保存为脚本（chat_to_script）🔲 待实现

**后端**需在 `chat_commands.rs` 添加：

```rust
#[tauri::command]
pub async fn chat_to_script(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    script_name: String,
) -> Result<AutomationScript, String>
```

逻辑：

1. 加载会话消息历史
2. 构造元提示词 + ScriptStep 文档 + 对话内容
3. 调用 `AiService::chat()` 生成 JSON
4. 反序列化为 `Vec<ScriptStep>` 并校验
5. 调用 `AutomationService::create_script()` 保存

---

## 八、验证方案

```bash
# 后端编译验证
cargo check --manifest-path src-tauri/Cargo.toml

# 前端编译验证
pnpm -s build

# 功能验证流程
# 1. pnpm tauri dev 启动应用
# 2. 侧边栏点击 "AI 助手"
# 3. 新建聊天，选择已运行的 Profile
# 4. 发送 "截取当前页面截图并描述内容"
# 5. 验证：工具调用卡片显示 cdp_screenshot，截图内联展示
# 6. 继续发送 "点击页面上的第一个按钮"
# 7. 验证：cdp_click 工具调用执行并显示结果
```

---

## 九、参考文件

| 文件                                                      | 参考用途                        |
| --------------------------------------------------------- | ------------------------------- |
| `src-tauri/src/commands/automation_commands.rs:1918-2235` | AiAgent tool calling 循环模板   |
| `src-tauri/src/services/ai_service.rs`                    | AiService API 参考              |
| `src-tauri/src/services/ai_tools/mod.rs`                  | ToolRegistry + ToolContext 参考 |
| `src/store/automation-store.ts`                           | Zustand store 模式参考          |
| `src/entities/automation/api/automation-api.ts`           | Tauri event 监听模式参考        |
| `src/features/automation/ui/automation-page.tsx`          | 双面板布局参考                  |
