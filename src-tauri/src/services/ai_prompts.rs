use crate::models::AiOutputKeyMapping;

// ═══════════════════════════════════════════════════════════════════════════════
// 中文 (zh) 系统提示词
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CORE_ZH: &str = "\
你是一个浏览器自动化执行引擎，运行在 Multi-Flow 多配置文件浏览器管理系统中。你正在控制一个已打开的浏览器配置文件实例，浏览器中可能已有页面内容。

【核心原则】
你必须通过调用工具来完成任务。绝不要回复「我需要更多信息」或要求用户提供额外信息。
- 不确定页面状态？→ 调用 cdp_screenshot 查看
- 需要读取页面内容？→ 调用 cdp_get_text 或 cdp_execute_js
- 需要与页面交互？→ 调用 cdp_click、cdp_type 等
- 第一步通常是 cdp_screenshot 来了解当前页面状态";

const TOOL_DESC_CDP_ZH: &str = "- cdp_*：页面交互（导航、点击、输入、获取文本、截图、执行JS等）";
const TOOL_DESC_MAGIC_ZH: &str =
    "- magic_*：浏览器窗口控制（窗口大小、标签管理、书签、Cookie、扩展等）";
const TOOL_DESC_APP_ZH: &str = "- app_*：应用数据查询与管理（配置文件、分组、代理等）";
const TOOL_DESC_FILE_ZH: &str = "- file_*：文件读写（受路径保护，10MB 限制）";
const TOOL_DESC_DIALOG_ZH: &str = "- dialog_*：用户交互弹窗（确认框、输入框、文件选择等）";
const TOOL_DESC_UTILITY_ZH: &str = "- wait / print：延时等待与日志输出";

const BASE_SCREENSHOTS_ZH: &str = "\
【截图与视觉】
- cdp_screenshot：截取页面内容区域，你可以直接看到截图内容进行视觉判断
- magic_capture_app_shell：截取完整窗口（包含浏览器标签栏和工具栏）
- 判断页面视觉状态时用截图；精确提取数据时用 cdp_get_text 或 cdp_execute_js";

const BASE_EXECUTION_ZH: &str = "\
【执行机制】
- 你必须通过工具调用来收集信息和执行操作，不要凭空猜测
- 可以连续多轮调用工具来完成任务
- 当准备好输出最终结果时，必须调用 submit_result 工具提交纯净的结果数据
- submit_result 的 result 参数只包含结果本身，不要包含解释、前言、标记或格式修饰";

const BASE_SAFETY_ZH: &str = "\
【安全注意】
- 慎用删除和关闭操作（app_delete_profile、magic_set_closed、file_write 覆盖等）
- 未经明确指示不要关闭或删除浏览器配置文件";

const BASE_MULTI_PROFILE_ZH: &str = "\
【多环境会话】
- `cdp_*` / `magic_*` 始终作用于当前工具目标环境
- 当会话关联多个环境时，先调用 `app_set_chat_active_profile(profile_id)` 切换目标环境，再执行浏览器工具
- `app_start_profile` 只负责启动环境，不会自动切换当前工具目标环境";

// ═══════════════════════════════════════════════════════════════════════════════
// English (en) system prompts
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CORE_EN: &str = "\
You are a browser automation execution engine running inside Multi-Flow, a multi-profile browser management system. You are controlling an already-opened browser profile instance which may have existing page content.

[Core Principles]
You must complete tasks by calling tools. Never reply with \"I need more information\" or ask the user for additional details.
- Unsure about page state? → Call cdp_screenshot to see
- Need to read page content? → Call cdp_get_text or cdp_execute_js
- Need to interact with the page? → Call cdp_click, cdp_type, etc.
- The first step is usually cdp_screenshot to understand the current page state";

const TOOL_DESC_CDP_EN: &str = "- cdp_*: Page interaction (navigation, clicks, input, get text, screenshots, execute JS, etc.)";
const TOOL_DESC_MAGIC_EN: &str =
    "- magic_*: Browser window control (window size, tab management, bookmarks, cookies, extensions, etc.)";
const TOOL_DESC_APP_EN: &str =
    "- app_*: Application data query & management (profiles, groups, proxies, etc.)";
const TOOL_DESC_FILE_EN: &str = "- file_*: File read/write (path-protected, 10MB limit)";
const TOOL_DESC_DIALOG_EN: &str =
    "- dialog_*: User interaction dialogs (confirm, input, file picker, etc.)";
const TOOL_DESC_UTILITY_EN: &str = "- wait / print: Delay and log output";

const BASE_SCREENSHOTS_EN: &str = "\
[Screenshots & Vision]
- cdp_screenshot: Capture the page content area; you can directly view the screenshot for visual assessment
- magic_capture_app_shell: Capture the full window (including browser tab bar and toolbar)
- Use screenshots for visual state assessment; use cdp_get_text or cdp_execute_js for precise data extraction";

const BASE_EXECUTION_EN: &str = "\
[Execution Mechanism]
- You must use tool calls to collect information and perform actions; do not guess
- You can call tools across multiple rounds to complete the task
- When ready to output the final result, you must call the submit_result tool with clean result data
- The result parameter of submit_result should only contain the result itself, without explanations, preambles, markers, or formatting";

const BASE_SAFETY_EN: &str = "\
[Safety Notes]
- Use delete and close operations with caution (app_delete_profile, magic_set_closed, file_write overwrite, etc.)
- Do not close or delete browser profiles without explicit instructions";

const BASE_MULTI_PROFILE_EN: &str = "\
[Multi-Profile Chats]
- `cdp_*` / `magic_*` always operate on the current tool target profile
- When multiple profiles are attached to the chat, call `app_set_chat_active_profile(profile_id)` before using browser tools
- `app_start_profile` only starts a profile and does not switch the current tool target automatically";

// ═══════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════════════

fn is_en(locale: &str) -> bool {
    locale.starts_with("en")
}

fn build_base_context(categories: &[String], locale: &str) -> String {
    let en = is_en(locale);
    let mut ctx = if en { BASE_CORE_EN } else { BASE_CORE_ZH }.to_string();
    ctx.push_str(if en {
        "\n\n[Tool Categories]\n"
    } else {
        "\n\n【工具分类】\n"
    });

    let all = categories.is_empty();
    if all || categories.iter().any(|c| c == "cdp") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_CDP_EN
        } else {
            TOOL_DESC_CDP_ZH
        });
    }
    if all || categories.iter().any(|c| c == "magic") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_MAGIC_EN
        } else {
            TOOL_DESC_MAGIC_ZH
        });
    }
    if all || categories.iter().any(|c| c == "app") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_APP_EN
        } else {
            TOOL_DESC_APP_ZH
        });
    }
    if all || categories.iter().any(|c| c == "file") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_FILE_EN
        } else {
            TOOL_DESC_FILE_ZH
        });
    }
    if all || categories.iter().any(|c| c == "dialog") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_DIALOG_EN
        } else {
            TOOL_DESC_DIALOG_ZH
        });
    }
    if all || categories.iter().any(|c| c == "utility") {
        ctx.push('\n');
        ctx.push_str(if en {
            TOOL_DESC_UTILITY_EN
        } else {
            TOOL_DESC_UTILITY_ZH
        });
    }

    ctx.push_str("\n\n");
    ctx.push_str(if en {
        BASE_SCREENSHOTS_EN
    } else {
        BASE_SCREENSHOTS_ZH
    });
    ctx.push_str("\n\n");
    ctx.push_str(if en {
        BASE_EXECUTION_EN
    } else {
        BASE_EXECUTION_ZH
    });
    ctx.push_str("\n\n");
    ctx.push_str(if en { BASE_SAFETY_EN } else { BASE_SAFETY_ZH });
    ctx.push_str("\n\n");
    ctx.push_str(if en {
        BASE_MULTI_PROFILE_EN
    } else {
        BASE_MULTI_PROFILE_ZH
    });
    ctx
}

/// 兼容旧调用：返回包含全部工具类别的基础上下文（中文）
pub fn base_context() -> String {
    build_base_context(&[], "zh")
}

/// 构建 AiAgent 完整系统提示词
pub fn build_agent_system_prompt(
    user_system_prompt: Option<&str>,
    is_json: bool,
    output_key_map: &[AiOutputKeyMapping],
    tool_categories: &[String],
    locale: &str,
) -> String {
    let mut result = build_base_context(tool_categories, locale);
    if let Some(sp) = user_system_prompt {
        result.push_str("\n\n");
        result.push_str(sp);
    }
    if is_json {
        result.push_str("\n\n");
        result.push_str(&build_json_instruction(output_key_map, locale));
    }
    result
}

fn build_json_instruction(output_key_map: &[AiOutputKeyMapping], locale: &str) -> String {
    let en = is_en(locale);
    let mut s = if en {
        String::from(
            "[Output Format]\n\
            When you have completed all tool calls and are ready to output the final result, reply with a valid JSON object.\n\
            - Do not include markdown code block markers\n\
            - Output the JSON object directly, ensure it can be parsed as-is",
        )
    } else {
        String::from(
            "【输出格式要求】\n\
            当你完成所有工具调用并准备输出最终结果时，必须以合法的 JSON 对象格式回复。\n\
            - 不要包含 markdown 代码块标记\n\
            - 直接输出 JSON 对象，确保可被直接解析",
        )
    };
    if !output_key_map.is_empty() {
        if en {
            s.push_str("\n\nThe system will extract the following fields from your JSON output:\n");
        } else {
            s.push_str("\n\n系统将从你的 JSON 输出中提取以下字段：\n");
        }
        for m in output_key_map {
            s.push_str(&format!(
                "- \"{}\" → variable {}\n",
                m.json_path, m.var_name
            ));
        }
        if en {
            s.push_str(
                "Please ensure your JSON output contains the fields at the paths listed above.",
            );
        } else {
            s.push_str("请确保输出的 JSON 包含上述路径对应的字段。");
        }
    }
    s
}

/// 构建 AI Chat 模式系统提示词（6 层分层架构）
///
/// 层级顺序：
/// - L0 Identity:     基础身份定义
/// - L1 Tools:        工具分类描述 + 截图说明 + 安全提醒
/// - L2 Environment:  Profile 环境上下文（指纹/代理/地理位置）
/// - L3 Global:       全局用户提示词
/// - L4 Per-chat:     每聊天提示词
/// - L5 Response:     回复模式说明
/// - L6 Summary:      对话摘要（压缩后的历史上下文）
pub fn build_chat_system_prompt(
    global_prompt: Option<&str>,
    per_chat_prompt: Option<&str>,
    tool_categories: &[String],
    locale: &str,
    environment_context: Option<&str>,
    conversation_summary: Option<&str>,
) -> String {
    let en = is_en(locale);
    let mut result = String::new();

    // L0 + L1: 基础上下文（身份 + 工具描述 + 截图 + 安全）
    let base = build_chat_base_context(tool_categories, locale);
    result.push_str(&base);

    // L2: 环境上下文
    if let Some(env) = environment_context {
        let env = env.trim();
        if !env.is_empty() {
            result.push_str("\n\n");
            result.push_str(env);
        }
    }

    // L3: 全局提示词
    if let Some(gp) = global_prompt {
        let gp = gp.trim();
        if !gp.is_empty() {
            result.push_str("\n\n");
            result.push_str(gp);
        }
    }

    // L4: 每聊天提示词
    if let Some(pp) = per_chat_prompt {
        let pp = pp.trim();
        if !pp.is_empty() {
            result.push_str("\n\n");
            result.push_str(pp);
        }
    }

    // L5: 对话式回复模式
    result.push_str("\n\n");
    if en {
        result.push_str(
            "[Response Mode]\n\
            You are in interactive chat mode. After completing tool calls, reply naturally in conversational language.\n\
            - Do not call submit_result — just reply with your findings or actions taken\n\
            - Be concise and direct\n\
            - For data results, format them clearly (tables, lists, etc.)",
        );
    } else {
        result.push_str(
            "【回复模式】\n\
            你处于交互聊天模式。完成工具调用后，用自然语言直接回复。\n\
            - 不要调用 submit_result，直接回复你的发现或已完成的操作\n\
            - 回复简洁直接\n\
            - 数据结果请清晰格式化（表格、列表等）",
        );
    }

    // L6: 对话摘要（压缩后的历史上下文）
    if let Some(summary) = conversation_summary {
        let summary = summary.trim();
        if !summary.is_empty() {
            result.push_str("\n\n");
            if en {
                result.push_str("[Previous Conversation Summary]\n");
            } else {
                result.push_str("【之前对话摘要】\n");
            }
            result.push_str(summary);
        }
    }

    result
}

/// 构建聊天模式基础上下文（去掉 AiAgent 的 submit_result 执行机制说明）
fn build_chat_base_context(categories: &[String], locale: &str) -> String {
    let en = is_en(locale);
    let mut ctx = if en { BASE_CORE_EN } else { BASE_CORE_ZH }.to_string();
    ctx.push_str(if en {
        "\n\n[Tool Categories]\n"
    } else {
        "\n\n【工具分类】\n"
    });

    let all = categories.is_empty();
    if all || categories.iter().any(|c| c == "cdp") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_CDP_EN } else { TOOL_DESC_CDP_ZH });
    }
    if all || categories.iter().any(|c| c == "magic") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_MAGIC_EN } else { TOOL_DESC_MAGIC_ZH });
    }
    if all || categories.iter().any(|c| c == "app") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_APP_EN } else { TOOL_DESC_APP_ZH });
    }
    if all || categories.iter().any(|c| c == "file") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_FILE_EN } else { TOOL_DESC_FILE_ZH });
    }
    if all || categories.iter().any(|c| c == "dialog") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_DIALOG_EN } else { TOOL_DESC_DIALOG_ZH });
    }
    if all || categories.iter().any(|c| c == "utility") {
        ctx.push('\n');
        ctx.push_str(if en { TOOL_DESC_UTILITY_EN } else { TOOL_DESC_UTILITY_ZH });
    }

    ctx.push_str("\n\n");
    ctx.push_str(if en { BASE_SCREENSHOTS_EN } else { BASE_SCREENSHOTS_ZH });
    ctx.push_str("\n\n");
    ctx.push_str(if en { BASE_SAFETY_EN } else { BASE_SAFETY_ZH });
    ctx
}

/// AiJudge boolean 模式系统提示词
pub fn judge_boolean_prompt(tool_categories: &[String], locale: &str) -> String {
    let en = is_en(locale);
    if en {
        format!(
            "{}\n\n\
            Your task is to make a boolean judgment. The user will describe a scenario to evaluate.\n\n\
            [Procedure]\n\
            1. Use tools to collect required information (cdp_screenshot to view the page, cdp_get_text to read content, etc.)\n\
            2. Make a judgment based on the collected information\n\
            3. In your final reply, output only true or false\n\n\
            [Output Format]\n\
            - Yes/true/pass → true\n\
            - No/false/fail → false\n\
            - Do not output any explanation, punctuation, or other text",
            build_base_context(tool_categories, locale)
        )
    } else {
        format!(
            "{}\n\n\
            你的任务是做出一个布尔判断。用户会描述需要判断的场景。\n\n\
            【操作流程】\n\
            1. 使用工具收集所需信息（cdp_screenshot 查看页面、cdp_get_text 读取内容等）\n\
            2. 基于收集到的信息做出判断\n\
            3. 最终回复时只输出 true 或 false\n\n\
            【输出格式】\n\
            - 判断为是/真/通过 → true\n\
            - 判断为否/假/不通过 → false\n\
            - 不要输出任何解释、标点或其他文字",
            build_base_context(tool_categories, locale)
        )
    }
}

/// AiJudge percentage 模式系统提示词
pub fn judge_percentage_prompt(tool_categories: &[String], locale: &str) -> String {
    let en = is_en(locale);
    if en {
        format!(
            "{}\n\n\
            Your task is to provide a confidence assessment (0-100). The user will describe a scenario to evaluate.\n\n\
            [Procedure]\n\
            1. Use tools to collect required information (cdp_screenshot to view the page, cdp_get_text to read content, etc.)\n\
            2. Make an assessment based on the collected information\n\
            3. In your final reply, output only an integer from 0 to 100\n\n\
            [Output Format]\n\
            - 0 = Completely does not match / Completely impossible\n\
            - 100 = Completely matches / Completely certain\n\
            - Do not output percentage signs, explanations, or other text",
            build_base_context(tool_categories, locale)
        )
    } else {
        format!(
            "{}\n\n\
            你的任务是给出一个置信度评估（0-100）。用户会描述需要评估的场景。\n\n\
            【操作流程】\n\
            1. 使用工具收集所需信息（cdp_screenshot 查看页面、cdp_get_text 读取内容等）\n\
            2. 基于收集到的信息做出评估\n\
            3. 最终回复时只输出一个 0-100 的整数\n\n\
            【输出格式】\n\
            - 0 = 完全不符合/完全不可能\n\
            - 100 = 完全符合/完全确定\n\
            - 不要输出百分号、解释或其他文字",
            build_base_context(tool_categories, locale)
        )
    }
}
