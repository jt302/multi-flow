# AI Chat 增强 — 完整架构与设计文档

> 创建日期: 2026-04-05
> 状态: **设计阶段 — 待实现**
> 基于版本: AI Chat Phase 1-4 完成后

---

## 目录

1. [概述与目标](#一概述与目标)
2. [浏览器环境信息提取与多选](#二浏览器环境信息提取与多选)
3. [系统提示词分层架构](#三系统提示词分层架构)
4. [工具感知设计](#四工具感知设计)
5. [大上下文处理](#五大上下文处理)
6. [自动压缩机制](#六自动压缩机制)
7. [超时设计](#七超时设计)
8. [运行过程展示](#八运行过程展示)
9. [思考过程展示](#九思考过程展示)
10. [工具调用过程展示](#十工具调用过程展示)
11. [AI 设置增强](#十一ai-设置增强)
12. [数据模型变更](#十二数据模型变更)
13. [新增 Tauri 命令](#十三新增-tauri-命令)
14. [依赖库选型](#十四依赖库选型)
15. [实现分期计划](#十五实现分期计划)
16. [参考标准与项目](#十六参考标准与项目)

---

## 一、概述与目标

### 1.1 现状问题

| 问题                               | 影响                                      | 严重度 |
| ---------------------------------- | ----------------------------------------- | ------ |
| 每次请求发送全部 146 个工具 schema | ~15-25k tokens 浪费，接近部分模型上限     | 高     |
| 无 token 计数，不知道何时溢出      | 超过上下文窗口时请求直接报错              | 高     |
| 截图 base64 内联存储在 SQLite      | 单张截图 ~70-170k tokens，快速耗尽上下文  | 高     |
| 无超时机制                         | 网络故障或慢模型导致无限等待              | 高     |
| 单 profile 绑定，无法多选          | 无法在一个对话中管理多个浏览器环境        | 中     |
| 系统提示词无浏览器环境感知         | AI 不知道控制的是哪个浏览器，什么指纹     | 中     |
| 运行展示仅显示"thinking"点动画     | 无法判断进展，不知道轮次/耗时/token       | 中     |
| 不支持思考过程（CoT）展示          | 错失 Claude/DeepSeek 的 extended thinking | 低     |
| 工具卡片显示原始 JSON              | 可读性差，大参数难以查看                  | 低     |

### 1.2 设计目标

1. 让 AI 了解当前控制的浏览器环境（指纹、代理、语言、时区等）
2. 建立可维护的系统提示词分层架构
3. 通过工具过滤、缓存、摘要减少 token 消耗
4. 主动监控上下文大小，自动压缩防止溢出
5. 三层超时保护机制（API / 工具 / 整体）
6. 提供详细的执行进度反馈（轮次、耗时、token 用量）
7. 支持 Claude/DeepSeek 思考过程可视化
8. 升级工具调用卡片的可读性和交互体验
9. 提供完整的 AI 设置面板（模型能力、成本估算、连接测试）

### 1.3 设计原则

- **优先复用**：使用项目已有组件（shadcn/ui, date-fns, ReactMarkdown），非必要不引入新库
- **渐进增强**：所有新功能向后兼容，旧会话无缝迁移
- **参考标准**：遵循 OpenAI Function Calling 规范、Anthropic API 规范、MCP 协议设计思路
- **不破坏现有流程**：`send_chat_message` 命令签名不变

---

## 二、浏览器环境信息提取与多选

### 2.1 需求分析

当前 AI 不知道自己在控制哪个浏览器环境。用户希望：

- 将所选环境的基本信息（指纹、代理、语言等）注入到系统提示词
- 支持同时选择多个 Profile，AI 了解全部环境信息
- 其中一个 Profile 作为"活跃环境"，CDP 工具连接到它

### 2.2 数据结构设计

#### Rust 端（新建 `profile_context_service.rs`）

```rust
// src-tauri/src/services/profile_context_service.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileEnvironmentContext {
    pub profile_id: String,
    pub profile_name: String,
    pub is_active: bool,          // 是否是 CDP 连接的活跃 Profile
    pub running: bool,            // 当前是否正在运行
    // 指纹信息（来自 ProfileSettings.fingerprint.fingerprint_snapshot）
    pub platform: Option<String>,          // e.g. "Windows 10", "macOS 14"
    pub browser_version: Option<String>,   // e.g. "Chrome/120"
    pub user_agent: Option<String>,
    pub language: Option<String>,          // e.g. "en-US"
    pub timezone: Option<String>,          // e.g. "America/New_York"
    pub viewport: Option<String>,          // e.g. "1920x1080"
    pub device_scale_factor: Option<f64>,  // e.g. 1.0, 2.0
    pub cpu_cores: Option<i64>,
    pub ram_gb: Option<i64>,
    // 地理位置（来自 ProfileSettings.advanced）
    pub geolocation: Option<String>,       // e.g. "40.7128,-74.0060"
    // 代理信息（来自 ProxyService + proxy binding）
    pub proxy_protocol: Option<String>,    // e.g. "socks5", "http"
    pub proxy_location: Option<String>,    // e.g. "US West"
    pub proxy_exit_ip: Option<String>,     // e.g. "203.0.113.5"
}

impl ProfileEnvironmentContext {
    /// 从 AppState 提取指定 Profile 的环境上下文
    pub fn extract(
        profile_service: &ProfileService,
        proxy_service: &ProxyService,
        engine_manager: &EngineManager,
        profile_id: &str,
        is_active: bool,
    ) -> Option<Self> {
        let profile = profile_service.get_profile(profile_id).ok()??;
        let settings: ProfileSettings = serde_json::from_str(
            profile.settings_json.as_deref().unwrap_or("{}")
        ).ok()?;

        let snap = settings.fingerprint.fingerprint_snapshot;
        let advanced = settings.advanced;

        // 代理信息
        let (proxy_protocol, proxy_location, proxy_exit_ip) =
            Self::extract_proxy_info(proxy_service, profile_id);

        // Viewport
        let viewport = snap.as_ref().and_then(|s| {
            match (s.window_width, s.window_height) {
                (Some(w), Some(h)) => Some(format!("{w}x{h}")),
                _ => None,
            }
        });

        // Geolocation
        let geolocation = advanced.as_ref().and_then(|a| {
            if a.geolocation_mode == "custom" {
                a.geolocation.as_ref().map(|g| format!("{:.4},{:.4}", g.latitude, g.longitude))
            } else {
                None
            }
        });

        Some(ProfileEnvironmentContext {
            profile_id: profile_id.to_string(),
            profile_name: profile.name,
            is_active,
            running: profile.running.unwrap_or(false),
            platform: snap.as_ref().and_then(|s| s.platform.clone()),
            browser_version: snap.as_ref().and_then(|s| s.browser_version.clone()),
            user_agent: snap.as_ref().and_then(|s| s.user_agent.clone()),
            language: snap.as_ref().and_then(|s| s.language.clone()),
            timezone: snap.as_ref().and_then(|s| s.time_zone.clone()),
            viewport,
            device_scale_factor: snap.as_ref().and_then(|s| s.device_scale_factor),
            cpu_cores: snap.as_ref().and_then(|s| s.custom_cpu_cores),
            ram_gb: snap.as_ref().and_then(|s| s.custom_ram_gb),
            geolocation,
            proxy_protocol,
            proxy_location,
            proxy_exit_ip,
        })
    }

    fn extract_proxy_info(
        proxy_service: &ProxyService,
        profile_id: &str,
    ) -> (Option<String>, Option<String>, Option<String>) {
        // 通过 ProfileProxyBinding 查找绑定的代理
        // 从代理的 exit_info 提取 exitIp / country / region
        // 简化实现，具体参考 proxy_service 现有接口
        (None, None, None)
    }
}
```

#### TypeScript 端（`src/entities/chat/model/types.ts` 增加）

```typescript
export type ProfileEnvironmentContext = {
	profileId: string;
	profileName: string;
	isActive: boolean;
	running: boolean;
	platform: string | null;
	browserVersion: string | null;
	userAgent: string | null;
	language: string | null;
	timezone: string | null;
	viewport: string | null;
	deviceScaleFactor: number | null;
	cpuCores: number | null;
	ramGb: number | null;
	geolocation: string | null;
	proxyProtocol: string | null;
	proxyLocation: string | null;
	proxyExitIp: string | null;
};
```

### 2.3 数据库 Schema 变更

```sql
-- 将 profile_id 扩展为多选
-- chat_sessions 新增两列
ALTER TABLE chat_sessions ADD COLUMN profile_ids TEXT;       -- JSON: ["id1", "id2"]
ALTER TABLE chat_sessions ADD COLUMN active_profile_id TEXT; -- CDP 连接的活跃 Profile

-- 旧数据迁移：将 profile_id 复制到两个新列
UPDATE chat_sessions
SET profile_ids = json_array(profile_id),
    active_profile_id = profile_id
WHERE profile_id IS NOT NULL;
```

### 2.4 前端 UI 设计

替换 `ChatHeader` 中的单选 Profile Select 为多选 Popover：

```
ChatHeader
  ├── [左侧] 会话标题（可编辑）
  └── [右侧控件区]
        ├── ProfileMultiSelect                    ← 新组件
        │     触发器: 已选 Profile 的小徽章列表
        │     Popover:
        │       ├── 搜索框（过滤 Profile 名称）
        │       ├── Profile 列表（带 Checkbox）
        │       │     每项显示: 运行状态绿点、名称、平台图标
        │       └── "Active for Tools" 单选
        │             （决定哪个 Profile 接受 CDP 命令）
        ├── AiConfigSelect（原有）
        └── SystemPrompt 折叠按钮（原有）
```

**组件实现要点**（使用已有的 shadcn `Popover` + `Command`）：

```tsx
// src/features/ai-chat/ui/profile-multi-select.tsx
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Command,
	CommandInput,
	CommandList,
	CommandItem,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Props = {
	selectedIds: string[];
	activeId: string | null;
	onChange: (ids: string[], activeId: string | null) => void;
};

// 使用 useProfilesQuery() 获取所有 profiles
// 选中的 Profile 在触发器以小 Badge 展示（最多显示 3 个，超出显示 +N）
// 活跃 Profile 徽章带蓝色边框区分
```

---

## 三、系统提示词分层架构

### 3.1 设计思路

参考 ChatGPT、Claude、Cursor 的系统提示词设计，采用 **关注点分离** 原则，将系统提示词分为明确职责的层级，各层独立维护、按需启用。

### 3.2 六层架构

```
┌─────────────────────────────────────────────────────────────┐
│  L0: IDENTITY  [硬编码，不可修改]                            │
│  定义 AI 的基本角色和运行环境                                │
│  "You are Multi-Flow AI Assistant..."                        │
├─────────────────────────────────────────────────────────────┤
│  L1: GLOBAL PROMPT  [用户配置，Settings 页面]               │
│  跨所有会话的全局指令                                        │
│  "Always respond in English. Prefer cdp_click over raw JS." │
├─────────────────────────────────────────────────────────────┤
│  L2: CAPABILITIES & TOOLS  [自动生成，按类别过滤]           │
│  工具能力摘要（单行描述，不是完整 schema）                   │
│  工具 schema 通过 API tools 参数传递，不在此处               │
├─────────────────────────────────────────────────────────────┤
│  L3: ENVIRONMENT CONTEXT  [自动注入，来自选中的 Profile]    │
│  当前控制的浏览器环境信息                                    │
│  Platform / UA / Language / Timezone / Proxy...              │
├─────────────────────────────────────────────────────────────┤
│  L4: SESSION PROMPT  [用户配置，每个聊天独立]               │
│  当前聊天的任务上下文                                        │
│  "You are testing login flows for an e-commerce site."      │
├─────────────────────────────────────────────────────────────┤
│  L5: CONVERSATION SUMMARY  [自动管理，压缩时插入]           │
│  历史对话的 LLM 摘要（旧消息压缩后的替代物）                 │
│  "Previously: Visited example.com, extracted 5 product..."  │
├─────────────────────────────────────────────────────────────┤
│  L6: RESPONSE MODE  [硬编码，chat 专用]                     │
│  聊天模式的回复指引                                          │
│  "You are in interactive chat mode. Reply naturally..."     │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 L3 环境上下文格式

```
[Browser Environment]
Active Profile: "MyProfile" (running)
  Platform    : Windows 10
  Browser     : Chrome/120
  Language    : en-US
  Timezone    : America/New_York
  Viewport    : 1920x1080 @ 1.0x DPI
  CPU / RAM   : 8 cores / 16 GB
  Geolocation : 40.7128, -74.0060
  Proxy       : socks5 → US West (exit IP: 203.0.113.5)

Other Selected Profiles:
  "Profile2" (stopped)  | macOS 14 | Chrome/120 | ja-JP | Asia/Tokyo | 2560x1440
  "Profile3" (running)  | Linux    | Chrome/120 | de-DE | Europe/Berlin | 1440x900
```

**单 Profile 且无代理时（最简情形）**:

```
[Browser Environment]
Active Profile: "Default" (running) | Windows 10 | Chrome/120 | en-US | America/New_York
```

**无 Profile 绑定时**: 省略整个 L3 块。

### 3.4 Rust 实现变更

修改 `src-tauri/src/services/ai_prompts.rs`：

```rust
// 新函数签名
pub fn build_chat_system_prompt(
    global_prompt: Option<&str>,
    per_chat_prompt: Option<&str>,
    tool_categories: &[String],
    locale: &str,
    profile_contexts: &[ProfileEnvironmentContext],  // 新增
    conversation_summary: Option<&str>,               // 新增
) -> String {
    let en = is_en(locale);
    let mut parts: Vec<String> = Vec::new();

    // L0: Identity
    parts.push(build_identity(en));

    // L1: Global Prompt
    if let Some(gp) = global_prompt.map(str::trim).filter(|s| !s.is_empty()) {
        parts.push(format!("[Global Instructions]\n{gp}"));
    }

    // L2: Capabilities (tool category summaries)
    parts.push(build_capabilities_section(tool_categories, en));

    // L3: Environment Context
    if !profile_contexts.is_empty() {
        parts.push(build_environment_context(profile_contexts, en));
    }

    // L4: Session Prompt
    if let Some(pp) = per_chat_prompt.map(str::trim).filter(|s| !s.is_empty()) {
        parts.push(format!("[Session Context]\n{pp}"));
    }

    // L5: Conversation Summary (当有压缩摘要时)
    if let Some(summary) = conversation_summary.map(str::trim).filter(|s| !s.is_empty()) {
        parts.push(if en {
            format!("[Previous Conversation Summary]\n{summary}")
        } else {
            format!("【历史对话摘要】\n{summary}")
        });
    }

    // L6: Response Mode
    parts.push(build_response_mode(en));

    parts.join("\n\n")
}

fn build_identity(en: bool) -> String {
    if en {
        "You are Multi-Flow AI Assistant, an intelligent browser automation agent \
         running inside a multi-profile browser management desktop application. \
         You help users automate browser tasks, manage browser profiles, \
         and extract information from websites through natural conversation."
            .to_string()
    } else {
        "你是 Multi-Flow AI 助手，一个运行在多浏览器配置管理桌面应用内的智能浏览器自动化 Agent。\
         你通过自然对话帮助用户自动化浏览器操作、管理浏览器配置文件，以及从网页提取信息。"
            .to_string()
    }
}

fn build_environment_context(
    profiles: &[ProfileEnvironmentContext],
    en: bool,
) -> String {
    let mut lines = vec![
        if en { "[Browser Environment]".to_string() }
        else { "【浏览器环境】".to_string() }
    ];

    let active = profiles.iter().find(|p| p.is_active);
    let others: Vec<_> = profiles.iter().filter(|p| !p.is_active).collect();

    if let Some(p) = active {
        let status = if p.running { "running" } else { "stopped" };
        lines.push(format!(
            "{}: \"{}\" ({status})",
            if en { "Active Profile" } else { "活跃 Profile" },
            p.profile_name
        ));

        // 详细信息
        if let Some(ref pl) = p.platform { lines.push(format!("  Platform    : {pl}")); }
        if let Some(ref bv) = p.browser_version { lines.push(format!("  Browser     : {bv}")); }
        if let Some(ref lang) = p.language { lines.push(format!("  Language    : {lang}")); }
        if let Some(ref tz) = p.timezone { lines.push(format!("  Timezone    : {tz}")); }
        if let Some(ref vp) = p.viewport {
            let scale = p.device_scale_factor.unwrap_or(1.0);
            lines.push(format!("  Viewport    : {vp} @ {scale}x DPI"));
        }
        if let (Some(cpu), Some(ram)) = (p.cpu_cores, p.ram_gb) {
            lines.push(format!("  CPU / RAM   : {cpu} cores / {ram} GB"));
        }
        if let Some(ref geo) = p.geolocation {
            lines.push(format!("  Geolocation : {geo}"));
        }
        if let Some(ref proto) = p.proxy_protocol {
            let loc = p.proxy_location.as_deref().unwrap_or("unknown");
            let ip = p.proxy_exit_ip.as_ref()
                .map(|ip| format!(" (exit IP: {ip})"))
                .unwrap_or_default();
            lines.push(format!("  Proxy       : {proto} → {loc}{ip}"));
        }
    }

    if !others.is_empty() {
        lines.push(if en { "\nOther Selected Profiles:".to_string() }
                   else { "\n其他已选 Profile：".to_string() });
        for p in others {
            let status = if p.running { "running" } else { "stopped" };
            let parts: Vec<String> = [
                Some(p.platform.clone().unwrap_or_default()),
                p.browser_version.clone(),
                p.language.clone(),
                p.timezone.clone(),
                p.viewport.clone(),
            ].iter().flatten().filter(|s| !s.is_empty()).cloned().collect();
            lines.push(format!(
                "  \"{}\" ({status})  | {}",
                p.profile_name,
                parts.join(" | ")
            ));
        }
    }

    lines.join("\n")
}
```

---

## 四、工具感知设计

### 4.1 当前问题

每次 API 请求都发送全部 146 个工具的 JSON Schema，估算 token 消耗：

- 平均每个工具 schema 约 150-300 token
- 146 个工具 × 200 token = ~29,200 tokens / 请求
- 对于 gpt-4o (128k 上下文) 占用 ~23%，对于 deepseek (64k) 占用 ~46%

### 4.2 三层工具过滤策略

```
Layer 1: 类别过滤（已有 ToolFilter）
  → 用户在会话设置中勾选启用的工具类别
  → 空 = 全部启用

Layer 2: 智能排除（新增）
  → Chat 模式: 排除 submit_result（不需要）
  → 未配置 CAPTCHA solver 时排除 captcha_* 类工具
  → 未绑定 Profile 时排除 cdp_* 和 magic_* 类工具（连接不上）

Layer 3: 相关性过滤（Phase 5，低优先级）
  → 基于对话历史中出现的工具名，优先保留最近使用过的工具
  → 当工具总数超过 max_tools 阈值时触发
```

### 4.3 Schema 缓存

`tool_defs::all_tool_definitions()` 每次调用都重新构建 `serde_json::Value` 树。使用 `std::sync::LazyLock` 缓存：

```rust
// src-tauri/src/services/ai_tools/mod.rs

use std::sync::LazyLock;

/// 所有工具 schema 的全局缓存（程序生命周期内只构建一次）
static ALL_TOOLS_CACHE: LazyLock<Vec<Value>> =
    LazyLock::new(|| tool_defs::all_tool_definitions());

impl ToolRegistry {
    pub fn definitions(filter: &ToolFilter) -> Vec<Value> {
        ALL_TOOLS_CACHE
            .iter()
            .filter(|t| filter.allows(tool_name_of(t)))
            .cloned()
            .collect()
    }
}
```

### 4.4 Chat 模式智能排除

在 `chat_execution_service.rs` 构建工具列表时：

```rust
fn build_chat_tool_filter(
    session: &ChatSession,
    has_profile: bool,
    has_captcha_solver: bool,
) -> ToolFilter {
    let mut categories = session.tool_categories.clone()
        .unwrap_or_default()
        .into_iter()
        .filter(|c| {
            // 无 profile 时排除浏览器相关工具
            if !has_profile && (c == "cdp" || c == "magic") {
                return false;
            }
            // 无 CAPTCHA 配置时排除
            if !has_captcha_solver && c == "captcha" {
                return false;
            }
            true
        })
        .collect::<Vec<_>>();

    // Chat 模式特殊排除：submit_result
    ToolFilter {
        categories,
        exclude_names: vec!["submit_result".to_string()],
    }
}
```

### 4.5 系统提示词中的工具摘要（L2 层）

系统提示词中只放简短的类别摘要（已有 `build_chat_base_context`，需优化）：

```
[Available Tool Categories]
• CDP Tools (43): Browser automation via Chrome DevTools Protocol
  - Navigate, click, type, screenshot, execute JS, manage tabs/cookies/storage
• Magic Tools (48): Window management and browser UI control
  - Window bounds, tab operations, bookmarks, cookie import/export, extensions
• App Data Tools (20): Profile and group management
  - CRUD for profiles, groups, proxies, plugins; start/stop browser sessions
• File Tools (6): Local file read/write operations
• Dialog Tools (13): User interaction dialogs
  - Message, confirm, input, file picker, form, table display
• Auto Tools (19): Automation script management
  - CRUD for scripts, runs, AI configs, CAPTCHA configs

Use tools by their exact names. Schemas are provided separately.
```

---

## 五、大上下文处理

### 5.1 Token 计数

**新建** `src-tauri/src/services/token_counter.rs`：

```rust
use tiktoken_rs::{cl100k_base, CoreBPE};
use std::sync::LazyLock;

static TOKENIZER: LazyLock<CoreBPE> = LazyLock::new(|| cl100k_base().unwrap());

pub struct TokenCounter;

impl TokenCounter {
    /// 估算文本的 token 数（使用 cl100k_base，适用于 GPT-4/Claude 近似值）
    pub fn count_text(text: &str) -> usize {
        TOKENIZER.encode_with_special_tokens(text).len()
    }

    /// 估算消息列表的 token 数
    pub fn count_messages(messages: &[ChatMessage]) -> usize {
        messages.iter().map(|m| {
            // 每条消息约 4 token 开销（role + formatting）
            4 + Self::count_content(&m.content)
                + m.tool_calls.as_ref()
                    .map(|tc| Self::count_text(&tc.to_string()))
                    .unwrap_or(0)
        }).sum()
    }

    fn count_content(content: &ChatContent) -> usize {
        match content {
            ChatContent::Text(t) => Self::count_text(t),
            ChatContent::Parts(parts) => parts.iter().map(|p| match p {
                ContentPart::Text { text } => Self::count_text(text),
                ContentPart::ImageUrl { .. } => 85, // 低分辨率图片固定估算
            }).sum(),
        }
    }

    /// 估算工具 schema 列表的 token 数
    pub fn count_tools(tools: &[serde_json::Value]) -> usize {
        tools.iter().map(|t| Self::count_text(&t.to_string())).sum()
    }

    /// 获取模型的上下文窗口大小（token 数）
    pub fn context_limit(provider: &str, model: &str) -> usize {
        match provider {
            "openai" => match model {
                m if m.starts_with("gpt-4.1") => 1_000_000,
                m if m.starts_with("o3") || m.starts_with("o4") => 200_000,
                m if m.starts_with("gpt-4o") => 128_000,
                m if m.starts_with("gpt-4") => 128_000,
                m if m.starts_with("gpt-3.5") => 16_385,
                _ => 128_000,
            },
            "anthropic" => 200_000, // claude-3.5+
            "deepseek" => match model {
                m if m.contains("r1") => 128_000,
                _ => 64_000,
            },
            "gemini" => match model {
                m if m.contains("2.0") || m.contains("2.5") => 1_048_576,
                m if m.contains("pro") => 2_097_152,
                _ => 1_048_576,
            },
            "groq" => 32_768,
            "together" => 32_768,
            "ollama" => 8_192,  // 保守估计，具体取决于模型
            "openrouter" => 128_000, // 取决于选择的模型
            _ => 32_000,
        }
    }
}
```

**Cargo.toml 新增**:

```toml
tiktoken-rs = "0.6"
```

### 5.2 图片外部化

**问题**: 单张截图（1920×1080）的 base64 约 200-500 KB，即 70,000-170,000 token，是最大的上下文炸弹。

**方案**: 将截图存储为磁盘文件，DB 只存文件路径引用。

**存储路径**: `{app_local_data_dir}/chat-images/{session_id}/{message_id}.png`

**Rust 实现**（在 `chat_execution_service.rs` 处理工具结果时）：

```rust
/// 将 base64 图片保存到磁盘，返回相对路径
async fn save_image_to_disk(
    app: &AppHandle,
    session_id: &str,
    message_id: &str,
    image_base64: &str,
) -> Result<String, String> {
    let data_dir = app.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = data_dir.join("chat-images").join(session_id);
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;

    let file_path = dir.join(format!("{message_id}.png"));
    let bytes = BASE64.decode(image_base64).map_err(|e| e.to_string())?;
    tokio::fs::write(&file_path, bytes).await.map_err(|e| e.to_string())?;

    // 返回相对路径（相对于 app_local_data_dir）
    Ok(format!("chat-images/{session_id}/{message_id}.png"))
}
```

**前端读取图片**（使用 Tauri 的 `convertFileSrc`）：

```typescript
import { appLocalDataDir } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

async function getChatImageUrl(imageRef: string): Promise<string> {
	const dataDir = await appLocalDataDir();
	return convertFileSrc(`${dataDir}/${imageRef}`);
}
```

**向后兼容**: `ChatMessageRecord` 同时保留 `imageBase64` 和 `imageRef` 字段，前端优先使用 `imageRef`，回退到 `imageBase64`：

```typescript
const imageSrc = message.imageRef
	? await getChatImageUrl(message.imageRef)
	: message.imageBase64
		? `data:image/png;base64,${message.imageBase64}`
		: null;
```

### 5.3 工具结果截断

在 `chat_execution_service.rs` 中，将工具结果写入 DB 和消息历史前进行截断：

```rust
const TOOL_RESULT_MAX_CHARS: usize = 4000;

/// 按工具类别决定最大字符数
fn tool_result_max_chars(tool_name: &str) -> usize {
    match ToolRegistry::category_of(tool_name) {
        "cdp" => 4_000,    // 网页文本可能很大
        "magic" => 2_000,
        "app" => 8_000,    // Profile 列表可能较长
        "file" => 4_000,
        "dialog" => 1_000, // 对话结果通常简短
        "auto" => 4_000,
        _ => 4_000,
    }
}

fn truncate_tool_result(result: &str, tool_name: &str) -> String {
    let max = tool_result_max_chars(tool_name);
    if result.len() <= max {
        return result.to_string();
    }
    format!(
        "{}\n... [output truncated, {} chars total, showing first {}]",
        &result[..max],
        result.len(),
        max
    )
}
```

### 5.4 滑动窗口策略

在每次 LLM 调用前，检查总 token 数并决定是否压缩：

```rust
/// 在 chat_execution_service.rs 的 tool-calling 循环中调用
async fn prepare_messages_for_llm(
    system_prompt: &str,
    db_messages: Vec<ChatMessage>,
    tools: &[Value],
    ai_config: &AiProviderConfig,
    ai_service: &AiService,
    chat_settings: &AiChatSettings,
) -> (Vec<ChatMessage>, Option<String>) {
    let context_limit = TokenCounter::context_limit(&ai_config.provider, &ai_config.model);
    let threshold = chat_settings.compress_threshold.unwrap_or(0.75);
    let keep_recent = chat_settings.recent_messages_keep.unwrap_or(10) as usize;
    let budget = (context_limit as f32 * threshold) as usize;

    let system_tokens = TokenCounter::count_text(system_prompt);
    let tools_tokens = TokenCounter::count_tools(tools);
    let mut messages_tokens = TokenCounter::count_messages(&db_messages);

    let total = system_tokens + tools_tokens + messages_tokens;

    if total <= budget || db_messages.len() <= keep_recent {
        return (db_messages, None);
    }

    // 需要压缩：保留最后 keep_recent 条，其余通过 LLM 摘要
    let split_at = db_messages.len().saturating_sub(keep_recent);
    let (to_compress, recent) = db_messages.split_at(split_at);

    if to_compress.is_empty() {
        return (db_messages, None);
    }

    // 调用 LLM 生成摘要
    match compress_messages(ai_service, ai_config, to_compress, &ai_config.locale).await {
        Ok(summary) => {
            // 将摘要作为第一条 user/assistant 消息（确保消息对完整性）
            let mut result = vec![ChatMessage {
                role: "system".to_string(),
                content: ChatContent::Text(summary.clone()),
                tool_calls: None,
                tool_call_id: None,
                name: None,
            }];
            result.extend_from_slice(recent);
            (result, Some(summary))
        }
        Err(_) => (db_messages, None), // 压缩失败时使用原始消息
    }
}
```

---

## 六、自动压缩机制

### 6.1 触发条件

```
total_tokens = system_prompt_tokens + tools_tokens + messages_tokens
if total_tokens > context_limit × threshold:
    trigger_compression()
```

默认 threshold = 0.75，留出 25% 空间给模型的回复。

### 6.2 压缩 LLM Prompt

```rust
async fn compress_messages(
    ai: &AiService,
    config: &AiProviderConfig,
    messages: &[ChatMessage],
    locale: &str,
) -> Result<String, String> {
    let en = is_en(locale);

    let compress_instruction = if en {
        "Summarize the following conversation history concisely. \
         PRESERVE: key findings, URLs visited, data extracted, errors encountered, \
         current task state, important variable values, and decision points. \
         OMIT: tool call parameter details, raw HTML content, duplicate information. \
         Write in third person, past tense."
    } else {
        "请简洁地总结以下对话历史。\
         保留：关键发现、访问的URL、提取的数据、遇到的错误、当前任务状态、重要变量值。\
         省略：工具调用的详细参数、原始HTML内容、重复信息。\
         使用第三人称、过去时。"
    };

    let history_text = messages.iter()
        .map(|m| format!("[{}] {}", m.role, content_to_text(&m.content)))
        .collect::<Vec<_>>()
        .join("\n\n");

    // 使用更快/更便宜的模型做摘要（如果可用）
    // 当前简化实现：使用同一个模型
    let compress_messages = vec![
        ChatMessage {
            role: "user".to_string(),
            content: ChatContent::Text(format!("{compress_instruction}\n\n{history_text}")),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    ];

    match ai.chat(config, compress_messages, None).await {
        Ok(AiChatResult::Text(summary)) => Ok(summary),
        _ => Err("Compression failed".to_string()),
    }
}
```

### 6.3 存储策略

压缩摘要作为特殊消息存储，原始消息软删除：

```rust
// 1. 插入摘要消息（role=system, compression_meta 标记）
chat_service.add_message(session_id, "system", &summary, AddMessageOptions {
    compression_meta: Some(json!({
        "type": "compression_summary",
        "original_count": messages_compressed_count,
        "compressed_at": now_timestamp(),
    })),
    ..Default::default()
});

// 2. 软删除原始消息
chat_service.deactivate_messages(session_id, sort_order_range);
```

### 6.4 前端展示

压缩发生时，在消息列表中显示分隔符：

```
───── 对话已压缩（45 条消息 → 摘要） ─────
  [展开查看完整历史]
```

新增 Tauri 事件:

```typescript
// 'ai_chat://compression'
type ChatCompressionEvent = {
	sessionId: string;
	originalCount: number; // 被压缩的消息数
	summaryLength: number; // 摘要字符数
};
```

### 6.5 用户控制

在 Settings 页面新增压缩配置区：

```
[上下文管理]
  ✓ 自动压缩            [开关]
  压缩触发阈值          [75% ──●──────] 上下文窗口使用量
  保留最近消息数        [10  ──●──────] 条（不压缩）
  [立即压缩当前对话]     [按钮]
```

---

## 七、超时设计

### 7.1 三层超时架构

```
┌─────────────────────────────────────────────────────────────┐
│  整体生成超时: 300s（包裹整个 tool-calling loop）           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  每轮 LLM API 超时: 120s                              │  │
│  │  ┌───────────────────────────────────────────────┐    │  │
│  │  │  每个工具执行超时: 30-300s（按类别）           │    │  │
│  │  └───────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 LLM API 超时

修改 `ai_service.rs`，为 `AiService` 增加可配置的 HTTP 客户端：

```rust
impl AiService {
    /// 使用指定超时创建实例（秒）
    pub fn with_timeout(timeout_secs: u64) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client");
        Self { http }
    }
}
```

在 `chat_execution_service.rs` 中：

```rust
let llm_timeout = settings.llm_timeout_secs.unwrap_or(120);
let ai = AiService::with_timeout(llm_timeout as u64);
```

### 7.3 工具执行超时

不同类别的工具有不同的合理超时时间：

```rust
fn tool_execution_timeout(tool_name: &str) -> std::time::Duration {
    use std::time::Duration;
    match ToolRegistry::category_of(tool_name) {
        "cdp" => Duration::from_secs(60),    // 网页导航/截图可能较慢
        "magic" => Duration::from_secs(30),
        "app" => Duration::from_secs(30),
        "file" => Duration::from_secs(30),
        "dialog" => Duration::from_secs(300), // 等待用户交互
        "captcha" => Duration::from_secs(120), // 远程 CAPTCHA 解决
        "auto" => Duration::from_secs(30),
        _ => Duration::from_secs(30),
    }
}

// 在工具执行处包裹超时
let timeout = tool_execution_timeout(&tool_call.name);
let result = tokio::time::timeout(
    timeout,
    async { ToolRegistry::execute(&tool_call.name, args, &mut ctx) }
).await;

let (result_text, image, status, duration) = match result {
    Ok(Ok(r)) => (r.text, r.image_base64, "completed", elapsed_ms),
    Ok(Err(e)) => (format!("Tool error: {e}"), None, "failed", elapsed_ms),
    Err(_) => (
        format!("Tool timed out after {}s", timeout.as_secs()),
        None,
        "failed",
        timeout.as_millis() as i64,
    ),
};
```

### 7.4 整体生成超时

```rust
let generation_timeout = Duration::from_secs(
    settings.generation_timeout_secs.unwrap_or(300) as u64
);
let generation_start = std::time::Instant::now();

for round in 0..MAX_CHAT_ROUNDS {
    // 检查整体超时
    if generation_start.elapsed() > generation_timeout {
        let msg = if en {
            format!("Generation stopped: exceeded {} second time limit.", generation_timeout.as_secs())
        } else {
            format!("生成已停止：超过 {} 秒时间限制。", generation_timeout.as_secs())
        };
        chat_service.add_message(session_id, "system", &msg, Default::default());
        emit_phase(app, session_id, "error", round + 1, None,
                   Some("generation_timeout".to_string()));
        return Ok(());
    }

    // ... 正常的工具调用循环
}
```

---

## 八、运行过程展示

### 8.1 增强的 ChatPhaseEvent

修改 `chat_execution_service.rs` 的事件结构：

```rust
// Rust 端
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatPhaseEvent {
    pub session_id: String,
    pub phase: String,          // "thinking" | "tool_calling" | "done" | "error"
    pub round: u32,
    // 新增字段
    pub max_rounds: u32,         // 最大轮次（当前固定 30）
    pub tool_name: Option<String>,
    pub error: Option<String>,
    pub elapsed_ms: u64,         // 从本次生成开始的耗时
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}
```

修改 `ai_service.rs` 提取 API 响应中的 token 用量：

```rust
// OpenAI-compatible 响应中解析 usage
let usage = response["usage"].as_object().map(|u| TokenUsage {
    prompt_tokens: u["prompt_tokens"].as_u64().unwrap_or(0) as u32,
    completion_tokens: u["completion_tokens"].as_u64().unwrap_or(0) as u32,
    total_tokens: u["total_tokens"].as_u64().unwrap_or(0) as u32,
});
```

### 8.2 TypeScript 类型

```typescript
// src/entities/chat/model/types.ts 更新
export type ChatPhaseEvent = {
	sessionId: string;
	phase: 'thinking' | 'tool_calling' | 'done' | 'error';
	round: number;
	maxRounds: number; // 新增
	toolName?: string;
	error?: string;
	elapsedMs: number; // 新增
	usage?: TokenUsage; // 新增
};

export type TokenUsage = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};
```

### 8.3 Zustand Store 更新

```typescript
// src/store/chat-store.ts
type ChatStoreState = {
    activeSessionId: string | null;
    isGenerating: boolean;
    generationPhase: 'idle' | 'thinking' | 'tool_calling' | 'done';
    currentToolName: string | null;
    liveMessages: ChatMessageRecord[];
    // 新增字段
    currentRound: number;
    maxRounds: number;
    elapsedMs: number;
    tokenUsage: TokenUsage | null;
    generationStartTime: number | null;
};

const initialState: ChatStoreState = {
    // ...
    currentRound: 0,
    maxRounds: 30,
    elapsedMs: 0,
    tokenUsage: null,
    generationStartTime: null,
};

// actions 更新
startGeneration: () => set({
    isGenerating: true,
    generationPhase: 'thinking',
    currentRound: 0,
    elapsedMs: 0,
    tokenUsage: null,
    generationStartTime: Date.now(),
}),

updatePhase: (event: ChatPhaseEvent) => set((state) => {
    if (event.phase === 'done' || event.phase === 'error') {
        return {
            isGenerating: false,
            generationPhase: 'idle',
            currentRound: event.round,
            elapsedMs: event.elapsedMs,
            tokenUsage: event.usage ?? state.tokenUsage,
        };
    }
    return {
        generationPhase: event.phase,
        currentToolName: event.toolName ?? null,
        currentRound: event.round,
        maxRounds: event.maxRounds,
        elapsedMs: event.elapsedMs,
        tokenUsage: event.usage ?? state.tokenUsage,
    };
}),
```

### 8.4 GenerationProgress 组件

```tsx
// src/features/ai-chat/ui/generation-progress.tsx
type Props = {
	phase: 'thinking' | 'tool_calling';
	round: number;
	maxRounds: number;
	currentToolName: string | null;
	elapsedMs: number;
	tokenUsage: TokenUsage | null;
};

export function GenerationProgress({
	phase,
	round,
	maxRounds,
	currentToolName,
	elapsedMs,
	tokenUsage,
}: Props) {
	const { t } = useTranslation('chat');

	return (
		<div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
			{/* 动态点 */}
			<span className="flex gap-0.5">
				<span className="animate-bounce [animation-delay:0ms]">•</span>
				<span className="animate-bounce [animation-delay:150ms]">•</span>
				<span className="animate-bounce [animation-delay:300ms]">•</span>
			</span>

			{/* 阶段描述 */}
			<span className="flex-1">
				{phase === 'thinking'
					? t('thinking')
					: t('executing', { name: currentToolName })}
			</span>

			{/* 轮次 */}
			<span className="tabular-nums">
				Round {round}/{maxRounds}
			</span>

			{/* 耗时 */}
			<span className="tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>

			{/* Token 用量（可选） */}
			{tokenUsage && (
				<span className="tabular-nums">
					{tokenUsage.totalTokens.toLocaleString()} tokens
				</span>
			)}
		</div>
	);
}
```

---

## 九、思考过程展示

### 9.1 支持的模型

| 提供商    | 模型                              | 实现方式                                 |
| --------- | --------------------------------- | ---------------------------------------- |
| Anthropic | claude-3.7-sonnet, claude-opus-4+ | Extended Thinking API（`thinking` 参数） |
| DeepSeek  | deepseek-reasoner (R1)            | 解析 `<think>...</think>` 标签           |
| OpenAI    | o1, o3, o4 系列                   | 响应中的 `reasoning_content` 字段        |

### 9.2 Anthropic Extended Thinking

修改 `ai_service.rs` 的 `chat_with_tools_anthropic()` 函数：

```rust
fn should_enable_thinking(model: &str) -> bool {
    model.contains("claude-3-7") || model.contains("claude-3.7")
        || model.contains("claude-opus-4") || model.contains("claude-sonnet-4")
}

fn build_anthropic_request(config: &AiProviderConfig, messages: &[Value], tools: &[Value]) -> Value {
    let mut body = json!({
        "model": config.model,
        "max_tokens": 16000,
        "messages": messages,
        "tools": tools,
    });

    if should_enable_thinking(&config.model) {
        // thinking 和 tool_use 不能同时使用 max_tokens < 1024
        body["thinking"] = json!({
            "type": "enabled",
            "budget_tokens": 10000  // 思考预算，可配置
        });
        body["max_tokens"] = json!(16000);
    }

    body
}

/// 从 Anthropic 响应中提取思考内容
fn extract_thinking_from_anthropic(response: &Value) -> Option<String> {
    response["content"].as_array()?.iter()
        .find(|block| block["type"] == "thinking")
        .and_then(|block| block["thinking"].as_str())
        .map(|s| s.to_string())
}
```

### 9.3 DeepSeek R1 思考提取

```rust
/// 从 DeepSeek R1 的响应文本中提取思考过程
fn extract_deepseek_thinking(text: &str) -> (Option<String>, String) {
    if let (Some(start), Some(end)) = (text.find("<think>"), text.find("</think>")) {
        let thinking = text[start + 7..end].trim().to_string();
        let response = text[end + 8..].trim().to_string();
        (Some(thinking), response)
    } else {
        (None, text.to_string())
    }
}
```

### 9.4 DB 存储

```sql
-- chat_messages 新增字段
ALTER TABLE chat_messages ADD COLUMN thinking_text TEXT;
ALTER TABLE chat_messages ADD COLUMN thinking_tokens INTEGER;
```

### 9.5 前端 ThinkingBlock 组件

```tsx
// src/features/ai-chat/ui/thinking-block.tsx
type Props = {
	thinkingText: string;
	thinkingTokens?: number;
	defaultOpen?: boolean;
};

export function ThinkingBlock({
	thinkingText,
	thinkingTokens,
	defaultOpen = false,
}: Props) {
	const [open, setOpen] = useState(defaultOpen);
	const { t } = useTranslation('chat');

	return (
		<div className="mb-2 rounded border border-dashed border-muted-foreground/30 text-xs">
			<button
				onClick={() => setOpen(!open)}
				className="flex w-full items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
			>
				<Brain className="h-3 w-3" />
				<span>{t('thinking')}</span>
				{thinkingTokens && (
					<span className="text-muted-foreground/60">
						({thinkingTokens.toLocaleString()} tokens)
					</span>
				)}
				<ChevronDown
					className={cn(
						'ml-auto h-3 w-3 transition-transform',
						open && 'rotate-180',
					)}
				/>
			</button>

			{open && (
				<div className="border-t border-dashed border-muted-foreground/30 px-3 py-2">
					<pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
						{thinkingText}
					</pre>
				</div>
			)}
		</div>
	);
}
```

在 `MessageItem` 中（assistant 消息渲染前）：

```tsx
{
	message.role === 'assistant' && message.thinkingText && (
		<ThinkingBlock
			thinkingText={message.thinkingText}
			thinkingTokens={message.thinkingTokens ?? undefined}
		/>
	);
}
```

---

## 十、工具调用过程展示

### 10.1 现状与改进目标

| 现状                                   | 改进目标                              |
| -------------------------------------- | ------------------------------------- |
| 工具名（monospace）+ 状态 badge + 耗时 | + 类别图标，duration 改为 bar 可视化  |
| 原始 JSON 参数                         | 结构化 Key-Value 表格，长值可展开     |
| 纯文本结果                             | 语法高亮（react-syntax-highlighter）  |
| 单图片内联                             | 缩略图 + 点击放大 Modal，多图 Gallery |
| 无错误详情                             | 红色错误样式 + 详细错误信息           |
| 无 AI 推理说明                         | 显示 assistant 伴随工具调用的文本     |

### 10.2 工具类别图标映射

```typescript
const TOOL_CATEGORY_ICONS: Record<string, LucideIcon> = {
	cdp: Globe, // 网页/浏览器
	magic: AppWindow, // 窗口管理
	app: Database, // 应用数据
	file: FileText, // 文件
	dialog: MessageSquare, // 对话框
	auto: Bot, // 自动化
	captcha: Shield, // 验证码
	utility: Wrench, // 工具
};

function getToolCategory(toolName: string): string {
	if (toolName.startsWith('cdp_')) return 'cdp';
	if (toolName.startsWith('magic_')) return 'magic';
	if (toolName.startsWith('app_')) return 'app';
	if (toolName.startsWith('file_')) return 'file';
	if (toolName.startsWith('dialog_')) return 'dialog';
	if (toolName.startsWith('auto_')) return 'auto';
	if (toolName.startsWith('captcha_')) return 'captcha';
	return 'utility';
}
```

### 10.3 增强的 ToolCallCard

```tsx
// src/features/ai-chat/ui/tool-call-card.tsx（重构版）

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = {
	message: ChatMessageRecord;
	onImageClick?: (src: string) => void; // 点击图片时打开 Modal
};

export function ToolCallCard({ message, onImageClick }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [argsExpanded, setArgsExpanded] = useState(false);

	const category = getToolCategory(message.toolName ?? '');
	const Icon = TOOL_CATEGORY_ICONS[category] ?? Wrench;
	const failed = message.toolStatus === 'failed';

	// 解析参数为 key-value 列表
	const args = useMemo(() => {
		try {
			return Object.entries(JSON.parse(message.toolArgsJson ?? '{}'));
		} catch {
			return [];
		}
	}, [message.toolArgsJson]);

	return (
		<div
			className={cn(
				'my-1 rounded-lg border text-xs',
				failed
					? 'border-destructive/50 bg-destructive/5'
					: 'border-border bg-muted/30',
			)}
		>
			{/* 头部（始终可见） */}
			<button
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 px-3 py-2 cursor-pointer"
			>
				<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				<code className="font-mono text-xs">{message.toolName}</code>

				<Badge
					variant={failed ? 'destructive' : 'secondary'}
					className="text-xs py-0"
				>
					{failed ? 'failed' : 'done'}
				</Badge>

				{/* 耗时可视化 */}
				{message.toolDurationMs && (
					<DurationBadge ms={message.toolDurationMs} />
				)}

				<ChevronDown
					className={cn(
						'ml-auto h-3 w-3 transition-transform',
						expanded && 'rotate-180',
					)}
				/>
			</button>

			{/* 展开内容 */}
			{expanded && (
				<div className="border-t border-border/50 px-3 py-2 space-y-3">
					{/* AI 推理说明（如果存在） */}
					{message.contentText && (
						<div className="text-muted-foreground italic">
							{message.contentText}
						</div>
					)}

					{/* 参数区 */}
					{args.length > 0 && (
						<div>
							<div className="mb-1 font-medium text-muted-foreground">
								Parameters
							</div>
							<table className="w-full">
								<tbody>
									{args.map(([key, value]) => (
										<ToolArgRow key={key} name={key} value={value} />
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* 结果区 */}
					{message.toolResult && (
						<div>
							<div className="mb-1 font-medium text-muted-foreground">
								{failed ? 'Error' : 'Result'}
							</div>
							<SyntaxHighlighter
								language={detectLanguage(message.toolResult)}
								style={vscDarkPlus}
								customStyle={{
									fontSize: '11px',
									maxHeight: '200px',
									margin: 0,
									borderRadius: '6px',
								}}
								wrapLongLines
							>
								{message.toolResult}
							</SyntaxHighlighter>
						</div>
					)}

					{/* 截图区 */}
					{message.imageBase64 && (
						<div>
							<div className="mb-1 font-medium text-muted-foreground">
								Screenshot
							</div>
							<img
								src={`data:image/png;base64,${message.imageBase64}`}
								className="max-h-48 cursor-pointer rounded border border-border/50"
								alt="Tool screenshot"
								onClick={() =>
									onImageClick?.(`data:image/png;base64,${message.imageBase64}`)
								}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function DurationBadge({ ms }: { ms: number }) {
	const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
	// 用颜色表示快/慢：<500ms 绿，<3000ms 黄，>3000ms 红
	const color =
		ms < 500
			? 'text-green-500'
			: ms < 3000
				? 'text-yellow-500'
				: 'text-red-500';
	return (
		<span className={cn('flex items-center gap-1', color)}>
			<Clock className="h-3 w-3" />
			{label}
		</span>
	);
}

function ToolArgRow({ name, value }: { name: string; value: unknown }) {
	const [expanded, setExpanded] = useState(false);
	const str =
		typeof value === 'string' ? value : JSON.stringify(value, null, 2);
	const isLong = str.length > 100;

	return (
		<tr className="border-b border-border/30 last:border-0">
			<td className="py-1 pr-3 font-mono text-muted-foreground align-top w-1/3">
				{name}
			</td>
			<td className="py-1 break-all">
				{isLong && !expanded ? (
					<>
						{str.slice(0, 100)}
						<button
							onClick={() => setExpanded(true)}
							className="text-primary cursor-pointer"
						>
							... more
						</button>
					</>
				) : (
					str
				)}
			</td>
		</tr>
	);
}

function detectLanguage(result: string): string {
	if (result.trimStart().startsWith('{') || result.trimStart().startsWith('['))
		return 'json';
	if (result.includes('<html') || result.includes('<!DOCTYPE')) return 'html';
	if (result.includes('function ') || result.includes('=>'))
		return 'javascript';
	return 'text';
}
```

### 10.4 图片放大 Modal

在 `AiChatPage` 中维护一个图片查看 Modal（使用 shadcn `Dialog`）：

```tsx
// ai-chat-page.tsx 中
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

// 渲染时传给消息列表
<ChatMessageList messages={allMessages} onImageClick={setLightboxSrc} />;

{
	lightboxSrc && (
		<Dialog open onOpenChange={() => setLightboxSrc(null)}>
			<DialogContent className="max-w-5xl p-2">
				<img src={lightboxSrc} className="w-full rounded" alt="Screenshot" />
			</DialogContent>
		</Dialog>
	);
}
```

---

## 十一、AI 设置增强

### 11.1 模型能力数据库

在前端维护静态模型能力表（TypeScript），不需要后端参与：

```typescript
// src/entities/ai/model/model-capabilities.ts

export type ModelCapabilities = {
	contextWindow: number; // token 数
	supportsVision: boolean;
	supportsTools: boolean;
	supportsThinking: boolean; // Extended Thinking / CoT
	supportsStreaming: boolean;
	inputPricePer1MToken: number; // USD
	outputPricePer1MToken: number;
	notes?: string;
};

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
	// OpenAI
	'gpt-4o': {
		contextWindow: 128_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 2.5,
		outputPricePer1MToken: 10,
	},
	'gpt-4o-mini': {
		contextWindow: 128_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 0.15,
		outputPricePer1MToken: 0.6,
	},
	'gpt-4.1': {
		contextWindow: 1_000_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 2,
		outputPricePer1MToken: 8,
	},
	o3: {
		contextWindow: 200_000,
		supportsVision: false,
		supportsTools: true,
		supportsThinking: true,
		supportsStreaming: true,
		inputPricePer1MToken: 10,
		outputPricePer1MToken: 40,
	},
	// Anthropic
	'claude-opus-4-5': {
		contextWindow: 200_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 15,
		outputPricePer1MToken: 75,
	},
	'claude-sonnet-4-20250514': {
		contextWindow: 200_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: true,
		supportsStreaming: true,
		inputPricePer1MToken: 3,
		outputPricePer1MToken: 15,
	},
	'claude-haiku-4-5-20251001': {
		contextWindow: 200_000,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 0.8,
		outputPricePer1MToken: 4,
	},
	// DeepSeek
	'deepseek-chat': {
		contextWindow: 64_000,
		supportsVision: false,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 0.14,
		outputPricePer1MToken: 0.28,
	},
	'deepseek-reasoner': {
		contextWindow: 128_000,
		supportsVision: false,
		supportsTools: false,
		supportsThinking: true,
		supportsStreaming: true,
		inputPricePer1MToken: 0.55,
		outputPricePer1MToken: 2.19,
		notes: 'Tool calling not supported; uses <think> tags for reasoning',
	},
	// Gemini
	'gemini-2.0-flash': {
		contextWindow: 1_048_576,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: false,
		supportsStreaming: true,
		inputPricePer1MToken: 0.1,
		outputPricePer1MToken: 0.4,
	},
	'gemini-2.5-pro': {
		contextWindow: 2_097_152,
		supportsVision: true,
		supportsTools: true,
		supportsThinking: true,
		supportsStreaming: true,
		inputPricePer1MToken: 1.25,
		outputPricePer1MToken: 10,
	},
};

export function getModelCapabilities(model: string): ModelCapabilities | null {
	// 精确匹配
	if (MODEL_CAPABILITIES[model]) return MODEL_CAPABILITIES[model];
	// 前缀匹配（处理版本号变体）
	const key = Object.keys(MODEL_CAPABILITIES).find(
		(k) => model.startsWith(k) || k.startsWith(model),
	);
	return key ? MODEL_CAPABILITIES[key] : null;
}
```

### 11.2 模型能力显示组件

在 `ChatHeader` 的 AI Config 选择器旁显示：

```tsx
// 简洁的 capability badge 行
function ModelCapabilityBadges({ model }: { model: string }) {
	const caps = getModelCapabilities(model);
	if (!caps) return null;

	return (
		<div className="flex items-center gap-1 text-xs text-muted-foreground">
			<span>{(caps.contextWindow / 1000).toFixed(0)}k ctx</span>
			{caps.supportsVision && <Eye className="h-3 w-3" title="Vision" />}
			{caps.supportsThinking && <Brain className="h-3 w-3" title="Thinking" />}
			{!caps.supportsTools && (
				<span className="text-yellow-500" title="No tool calling">
					⚠️
				</span>
			)}
		</div>
	);
}
```

### 11.3 连接测试命令

新增 Tauri 命令 `test_ai_connection`：

```rust
// src-tauri/src/commands/chat_commands.rs

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub model_verified: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_ai_connection(
    config_id: String,
    state: State<'_, AppState>,
) -> Result<ConnectionTestResult, String> {
    let config = {
        let pref = state.preference_service.lock()
            .unwrap_or_else(|p| p.into_inner());
        pref.find_ai_config_by_id(&config_id)
            .ok_or("Config not found")?
    };

    let provider_config = ai_config_entry_to_provider_config(&config);
    let ai = AiService::with_timeout(10); // 测试用短超时

    let start = std::time::Instant::now();
    let test_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: ChatContent::Text("Say 'ok'".to_string()),
        ..Default::default()
    }];

    match ai.chat(&provider_config, test_messages, None).await {
        Ok(_) => Ok(ConnectionTestResult {
            success: true,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            model_verified: true,
            error: None,
        }),
        Err(e) => Ok(ConnectionTestResult {
            success: false,
            latency_ms: None,
            model_verified: false,
            error: Some(e),
        }),
    }
}
```

### 11.4 AI 聊天设置页卡

新增 `src/features/settings/ui/ai-chat-settings-card.tsx`：

```
┌─ AI Chat 设置 ──────────────────────────────────────┐
│                                                       │
│  超时配置                                             │
│  LLM API 超时     [120s ────●────────]               │
│  工具执行超时     [60s  ───●─────────]               │
│  整体生成超时     [300s ─────────●──]                │
│                                                       │
│  上下文管理                                           │
│  自动压缩         [✓ 开启]                           │
│  压缩触发阈值     [75% ─────●───────]                │
│  保留最近消息     [10  ──●──────────] 条              │
│                                                       │
│  Token 用量统计                                       │
│  本月用量: 1,234,567 tokens (≈ $2.47)               │
│  [重置统计] [查看明细]                               │
│                                                       │
│  模型能力参考                                         │
│  [选择模型查看其能力规格]                            │
│  GPT-4o: 128k ctx | Vision ✓ | Tools ✓ | $2.5/$10  │
└─────────────────────────────────────────────────────┘
```

---

## 十二、数据模型变更

### 12.1 DB Migration

新建 `src-tauri/src/db/migrator/m20260406_000028_enhance_chat_system.rs`：

```rust
use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str { "m20260406_000028_enhance_chat_system" }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // chat_sessions: 多 Profile 支持
        manager.alter_table(
            Table::alter()
                .table(Alias::new("chat_sessions"))
                .add_column(ColumnDef::new(Alias::new("profile_ids")).text())
                .add_column(ColumnDef::new(Alias::new("active_profile_id")).text())
                .to_owned(),
        ).await?;

        // 迁移旧数据
        manager.get_connection().execute_unprepared(
            "UPDATE chat_sessions SET profile_ids = json_array(profile_id), \
             active_profile_id = profile_id WHERE profile_id IS NOT NULL"
        ).await?;

        // chat_messages: 思考过程 + 图片外部化 + Token 统计 + 压缩标记
        manager.alter_table(
            Table::alter()
                .table(Alias::new("chat_messages"))
                .add_column(ColumnDef::new(Alias::new("thinking_text")).text())
                .add_column(ColumnDef::new(Alias::new("thinking_tokens")).integer())
                .add_column(ColumnDef::new(Alias::new("image_ref")).text())
                .add_column(ColumnDef::new(Alias::new("prompt_tokens")).integer())
                .add_column(ColumnDef::new(Alias::new("completion_tokens")).integer())
                .add_column(ColumnDef::new(Alias::new("compression_meta")).text())
                .to_owned(),
        ).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 简化：仅删除新增列
        // 实际生产环境建议保留 down migration
        Ok(())
    }
}
```

### 12.2 AppPreferences 新增字段

在 `app_preference_service.rs` 的 `AppPreferencesFile` 中新增：

```rust
// AI Chat 超时配置
#[serde(default)]
pub ai_chat_llm_timeout_secs: Option<u32>,         // 默认 120
#[serde(default)]
pub ai_chat_tool_timeout_secs: Option<u32>,         // 默认 60
#[serde(default)]
pub ai_chat_generation_timeout_secs: Option<u32>,   // 默认 300

// 上下文管理
#[serde(default)]
pub ai_chat_auto_compress: Option<bool>,            // 默认 true
#[serde(default)]
pub ai_chat_compress_threshold: Option<f32>,        // 默认 0.75
#[serde(default)]
pub ai_chat_recent_messages_keep: Option<u32>,      // 默认 10

// 用量统计
#[serde(default)]
pub ai_chat_token_usage_total: Option<u64>,
```

---

## 十三、新增 Tauri 命令

### 13.1 命令列表

| 命令名                            | 参数                                                  | 返回值                           | 说明              |
| --------------------------------- | ----------------------------------------------------- | -------------------------------- | ----------------- |
| `get_profile_environment_context` | `profile_ids: Vec<String>, active_id: Option<String>` | `Vec<ProfileEnvironmentContext>` | 批量提取环境信息  |
| `compress_chat_history`           | `session_id: String`                                  | `CompressionResult`              | 手动触发压缩      |
| `estimate_session_tokens`         | `session_id: String`                                  | `TokenEstimate`                  | 估算当前 token 数 |
| `test_ai_connection`              | `config_id: String`                                   | `ConnectionTestResult`           | 测试 API 连接     |
| `read_ai_chat_settings`           | —                                                     | `AiChatSettings`                 | 读取聊天设置      |
| `update_ai_chat_settings`         | `settings: AiChatSettings`                            | `()`                             | 保存聊天设置      |

### 13.2 返回类型定义

```rust
#[derive(Debug, Serialize)]
pub struct CompressionResult {
    pub compressed_count: usize,   // 被压缩的消息数
    pub summary_length: usize,     // 摘要字符数
}

#[derive(Debug, Serialize)]
pub struct TokenEstimate {
    pub system_prompt_tokens: usize,
    pub messages_tokens: usize,
    pub tools_tokens: usize,
    pub total_tokens: usize,
    pub context_limit: usize,
    pub usage_percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiChatSettings {
    pub llm_timeout_secs: u32,
    pub tool_timeout_secs: u32,
    pub generation_timeout_secs: u32,
    pub auto_compress: bool,
    pub compress_threshold: f32,
    pub recent_messages_keep: u32,
    pub token_usage_total: u64,
}
```

---

## 十四、依赖库选型

### 14.1 后端（Rust）

| 需求            | 库                     | 版本   | 说明                                                       |
| --------------- | ---------------------- | ------ | ---------------------------------------------------------- |
| Token 计数      | `tiktoken-rs`          | `0.6`  | OpenAI cl100k_base tokenizer，适用于 GPT-4/Claude 近似计数 |
| 异步工具超时    | `tokio::time::timeout` | (已有) | Tokio 标准功能，无需新增                                   |
| Base64 图片解码 | `base64`               | (已有) | 已在 Cargo.toml 中                                         |

### 14.2 前端（React/TS）

| 需求           | 库                           | 版本      | 理由                                               |
| -------------- | ---------------------------- | --------- | -------------------------------------------------- |
| 代码语法高亮   | `react-syntax-highlighter`   | `^15.6.1` | 成熟稳定，支持 Prism/Highlight.js，React 生态标准  |
| 多选 Popover   | shadcn `Command` + `Popover` | (已有)    | 项目已有 shadcn，`cmdk` 提供 fuzzy search 开箱即用 |
| 图片放大 Modal | shadcn `Dialog`              | (已有)    | 无需新增库                                         |
| 时间格式       | `date-fns`                   | (已有)    | 项目已安装                                         |
| 图标           | `lucide-react`               | (已有)    | 项目已有                                           |

> **不引入**: tiktoken JS 版本（太重，仅用于展示估算，不需要精确；通过后端命令获取）

---

## 十五、实现分期计划

### Phase 1（高优先级）— 环境感知 + 多选

**目标**: AI 了解浏览器环境，用户能多选 Profile

**涉及文件**:

- `src-tauri/src/services/profile_context_service.rs` (新建)
- `src-tauri/src/services/ai_prompts.rs` (修改签名，增加 L0/L3/L5)
- `src-tauri/src/services/chat_execution_service.rs` (注入环境上下文)
- `src-tauri/src/db/migrator/m20260406_000028_*` (新建迁移)
- `src-tauri/src/commands/chat_commands.rs` (+`get_profile_environment_context`)
- `src/features/ai-chat/ui/profile-multi-select.tsx` (新建组件)
- `src/features/ai-chat/ui/chat-header.tsx` (替换 Profile 选择器)
- `src/entities/chat/model/types.ts` (更新 ChatSession 类型)

**验收**: AI 在系统提示词中正确包含选中 Profile 的环境信息

### Phase 2（高优先级）— 上下文管理

**目标**: token 计数 + 自动压缩 + 图片外部化 + 工具截断

**涉及文件**:

- `src-tauri/Cargo.toml` (添加 tiktoken-rs)
- `src-tauri/src/services/token_counter.rs` (新建)
- `src-tauri/src/services/chat_execution_service.rs` (集成压缩逻辑)
- `src-tauri/src/services/ai_service.rs` (提取 token usage)
- `src-tauri/src/services/app_preference_service.rs` (新增设置字段)

**验收**: 长对话不再报"context length exceeded"错误

### Phase 3（中优先级）— 运行展示 + 思考过程

**目标**: 轮次/耗时/token显示 + thinking block

**涉及文件**:

- `src-tauri/src/services/chat_execution_service.rs` (增强 ChatPhaseEvent)
- `src-tauri/src/services/ai_service.rs` (Anthropic thinking, DeepSeek R1 解析)
- `src/store/chat-store.ts` (新状态字段)
- `src/features/ai-chat/ui/generation-progress.tsx` (新组件)
- `src/features/ai-chat/ui/thinking-block.tsx` (新组件)
- `src/features/ai-chat/ui/chat-message-list.tsx` (集成)

**验收**: 生成时显示 "Round 3/30 | 12.3s | 1,234 tokens"

### Phase 4（中优先级）— 工具卡片升级 + AI 设置

**目标**: 更好的工具可视化 + 完整设置面板

**涉及文件**:

- `package.json` (添加 react-syntax-highlighter)
- `src/features/ai-chat/ui/tool-call-card.tsx` (重构)
- `src/features/settings/ui/ai-chat-settings-card.tsx` (新建)
- `src/entities/ai/model/model-capabilities.ts` (新建)
- `src-tauri/src/commands/chat_commands.rs` (+`test_ai_connection`, `read/update_ai_chat_settings`)

**验收**: 工具结果有语法高亮，设置页有超时/压缩/统计配置

### Phase 5（低优先级）— 工具系统优化

**目标**: 动态工具注入 + schema 缓存

**涉及文件**:

- `src-tauri/src/services/ai_tools/mod.rs` (LazyLock 缓存，智能排除)
- `src-tauri/src/services/chat_execution_service.rs` (chat 模式工具过滤)

---

## 十六、参考标准与项目

### 系统提示词设计

- [OpenAI Best Practices for Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic "Give Claude a Role"](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts)
- ChatGPT Custom Instructions 分层设计
- Cursor / Windsurf 的 Agent Prompt 分层策略

### 工具调用 / Function Calling

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) — Anthropic 提出的工具调用标准化协议

### 上下文管理

- [LangChain ConversationSummaryBufferMemory](https://python.langchain.com/docs/modules/memory/types/summary_buffer) — LLM 摘要 + 滑动窗口混合策略
- Claude Code 的自动上下文压缩机制（实现在本产品中）
- [OpenAI Context Window Management](https://platform.openai.com/docs/guides/context-windows)

### Thinking / Chain-of-Thought

- [Anthropic Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [DeepSeek R1 Reasoning Traces](https://huggingface.co/deepseek-ai/DeepSeek-R1)
- [OpenAI o1/o3 Reasoning Summary](https://platform.openai.com/docs/guides/reasoning)

### 工具调用可视化 UI

- [LangSmith Trace Viewer](https://smith.langchain.com/) — 工业级工具调用链路可视化
- ChatGPT 工具调用 UI 模式（折叠卡片 + 状态 badge）
- Cursor Agent 执行进度展示模式

### Token 计数

- [tiktoken-rs](https://github.com/zurawiki/tiktoken-rs) — Rust 实现的 OpenAI tokenizer
- [OpenAI Tokenizer](https://platform.openai.com/tokenizer) — 官方在线工具

---

## 附录：文件变更清单

### 新建文件

| 文件路径                                                            | 说明                   |
| ------------------------------------------------------------------- | ---------------------- |
| `src-tauri/src/services/profile_context_service.rs`                 | Profile 环境上下文提取 |
| `src-tauri/src/services/token_counter.rs`                           | Token 计数工具         |
| `src-tauri/src/db/migrator/m20260406_000028_enhance_chat_system.rs` | DB 迁移                |
| `src/features/ai-chat/ui/profile-multi-select.tsx`                  | Profile 多选组件       |
| `src/features/ai-chat/ui/generation-progress.tsx`                   | 运行进度组件           |
| `src/features/ai-chat/ui/thinking-block.tsx`                        | 思考过程展示           |
| `src/features/settings/ui/ai-chat-settings-card.tsx`                | AI 聊天设置卡片        |
| `src/entities/ai/model/model-capabilities.ts`                       | 模型能力数据           |

### 修改文件

| 文件路径                                           | 变更内容                                      |
| -------------------------------------------------- | --------------------------------------------- |
| `src-tauri/src/services/ai_prompts.rs`             | 6 层提示词架构，新增 L0/L3                    |
| `src-tauri/src/services/ai_service.rs`             | 超时配置，thinking 解析，token usage 提取     |
| `src-tauri/src/services/chat_execution_service.rs` | 超时、压缩、环境注入、增强事件                |
| `src-tauri/src/services/chat_service.rs`           | 图片外部化，压缩消息支持                      |
| `src-tauri/src/services/app_preference_service.rs` | 新增 AI Chat 设置字段                         |
| `src-tauri/src/services/ai_tools/mod.rs`           | Schema 缓存，智能排除                         |
| `src-tauri/src/commands/chat_commands.rs`          | 新增 5 个命令                                 |
| `src-tauri/Cargo.toml`                             | 添加 `tiktoken-rs`                            |
| `src/store/chat-store.ts`                          | 新增运行状态字段                              |
| `src/features/ai-chat/ui/chat-header.tsx`          | Profile 多选，模型能力显示                    |
| `src/features/ai-chat/ui/chat-message-list.tsx`    | 集成新组件                                    |
| `src/features/ai-chat/ui/tool-call-card.tsx`       | 重构（图标、高亮、图片 Modal）                |
| `src/entities/chat/model/types.ts`                 | 更新 ChatSession/ChatMessageRecord/Event 类型 |
| `src/entities/chat/api/chat-api.ts`                | 新增 API 调用函数                             |
| `package.json`                                     | 添加 `react-syntax-highlighter`               |
