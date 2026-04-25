use crate::models::AiOutputKeyMapping;

// ═══════════════════════════════════════════════════════════════════════════════
// 中文 (zh) 系统提示词
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CORE_ZH: &str = "\
你是一个浏览器自动化执行引擎，运行在 Multi-Flow 多配置文件浏览器管理系统中。你正在控制一个已打开的浏览器配置文件实例，浏览器中可能已有页面内容。

【核心原则】
你必须通过调用工具来完成任务。绝不要回复「我需要更多信息」或要求用户提供额外信息。
- 不确定页面状态？→ 调用 cdp_screenshot 查看
- 需要读取页面内容？→ 优先 cdp_get_text（单元素）/ cdp_get_full_ax_tree（语义树）/ cdp_execute_js（批量/复杂）/ cdp_get_page_source（HTML源码）
- 需要与页面交互？→ 调用 cdp_click、cdp_type 等
- 需要输入文本？→ 优先使用 magic_type_string（先用 cdp_click 聚焦输入框，再调用 magic_type_string 输入）
- 第一步通常是 cdp_screenshot 来了解当前页面状态";

const TOOL_DESC_CDP_ZH: &str = "- cdp_*：页面交互（导航、点击、输入、获取文本、截图、执行JS等）";
const TOOL_DESC_MAGIC_ZH: &str =
    "- magic_*：浏览器窗口控制（窗口大小、标签管理、书签、Cookie、扩展等）；以及 AI Agent 语义化操作（DOM 查询/点击/填写、UI 元素点击、页面信息获取、坐标系点击等）";
const TOOL_DESC_APP_ZH: &str = "- app_*：应用数据查询与管理（配置文件、机型预设、分组、代理等）";
const TOOL_DESC_FILE_ZH: &str = "- file_*：app 内 fs 文件系统读写（仅限相对路径，10MB 限制）";
const TOOL_DESC_DIALOG_ZH: &str = "- dialog_*：用户交互弹窗（确认框、输入框、文件选择等）";
const TOOL_DESC_UTILITY_ZH: &str =
    "- wait / print / exec_command：延时等待、日志输出、受控命令执行（参数数组、默认先探测运行时、缺失时不自动安装）";

const BASE_SCREENSHOTS_ZH: &str = "\
【截图与视觉】
- cdp_screenshot：截取页面内容区域，你可以直接看到截图内容进行视觉判断
- magic_capture_app_shell：截取完整窗口（包含浏览器标签栏和工具栏）
- 判断页面视觉状态时用截图；精确提取数据时用 cdp_get_text 或 cdp_execute_js
- 禁止用截图来提取文本数据 — 截图仅用于视觉判断，文本数据必须通过 cdp_get_text / cdp_get_full_ax_tree / cdp_execute_js 提取
- SPA/动态页面数据提取：优先 cdp_get_full_ax_tree（语义结构）或 cdp_execute_js（自定义 JS 批量提取）";

const BASE_EXECUTION_ZH: &str = "\
【执行机制】
- 你必须通过工具调用来收集信息和执行操作，不要凭空猜测
- 可以连续多轮调用工具来完成任务
- 当准备好输出最终结果时，必须调用 submit_result 工具提交纯净的结果数据
- submit_result 的 result 参数只包含结果本身，不要包含解释、前言、标记或格式修饰";

const BASE_SAFETY_ZH: &str = "\
【安全注意】
- 慎用删除和关闭操作（app_delete_profile、magic_set_closed、file_write 覆盖等）
- 未经明确指示不要关闭或删除浏览器配置文件
- 使用 `exec_command` 时必须传 `command + args`，不要传整段 shell
- 命令缺失时先给出替代方案或安装建议，不要反复盲试";

const BASE_MULTI_PROFILE_ZH: &str = "\
【多环境会话】
- `cdp_*` / `magic_*` 始终作用于当前工具目标环境
- 当会话关联多个环境时，先调用 `app_set_chat_active_profile(profile_id)` 切换目标环境，再执行浏览器工具
- `app_start_profile` 只负责启动环境，不会自动切换当前工具目标环境";

const BASE_CAPTCHA_CHAT_ZH: &str = "\
【验证码处理】
- 遇到验证码时，首先调用 `auto_list_captcha_configs` 检查是否已配置求解服务
- 如果已配置求解服务：按 `captcha_detect` → `captcha_solve_and_inject` 流程自动求解
- 如果未配置求解服务或自动求解失败：通过 `dialog_message` 通知用户需要人工介入处理验证码，暂停当前操作等待用户处理完成
- `captcha_*` 工具只有在页面实际离开验证码/风控阻塞状态时，才算处理成功
- 拿到 token、写入隐藏字段或触发回调，不等于页面已经通过验证
- 如果验证码仍未通过，必须明确说明当前被验证码阻塞，不能表述成已完成
- 未经用户明确同意，不要因为验证码失败就擅自切换到 DuckDuckGo 或其他替代站点
- 在调用 captcha_solve 前先准确识别验证码类型（slider != reCAPTCHA != hCaptcha）
- 如果验证码连续失败 3 次，停止自动化并向用户报告阻碍；不要继续重试";

// ═══════════════════════════════════════════════════════════════════════════════
// English (en) system prompts
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CORE_EN: &str = "\
You are a browser automation execution engine running inside Multi-Flow, a multi-profile browser management system. You are controlling an already-opened browser profile instance which may have existing page content.

[Core Principles]
You must complete tasks by calling tools. Never reply with \"I need more information\" or ask the user for additional details.
- Unsure about page state? → Call cdp_screenshot to see
- Need to read page content? → Prefer cdp_get_text (single element) / cdp_get_full_ax_tree (semantic tree) / cdp_execute_js (batch/complex) / cdp_get_page_source (HTML source)
- Need to interact with the page? → Call cdp_click, cdp_type, etc.
- Need to input text? → Prefer magic_type_string (first cdp_click on the input field to focus it, then call magic_type_string)
- The first step is usually cdp_screenshot to understand the current page state";

const TOOL_DESC_CDP_EN: &str = "- cdp_*: Page interaction (navigation, clicks, input, get text, screenshots, execute JS, etc.)";
const TOOL_DESC_MAGIC_EN: &str =
    "- magic_*: Browser window control (window size, tab management, bookmarks, cookies, extensions, etc.); and AI Agent semantic operations (DOM query/click/fill, UI element click, page info, coordinate-based click, etc.)";
const TOOL_DESC_APP_EN: &str =
    "- app_*: Application data query & management (profiles, device presets, groups, proxies, etc.)";
const TOOL_DESC_FILE_EN: &str =
    "- file_*: File read/write inside the app fs directory (relative paths only, 10MB limit)";
const TOOL_DESC_DIALOG_EN: &str =
    "- dialog_*: User interaction dialogs (confirm, input, file picker, etc.)";
const TOOL_DESC_UTILITY_EN: &str =
    "- wait / print / exec_command: Delay, log output, and guarded command execution (argument array only, runtime probe first, no auto-install when missing)";

const BASE_SCREENSHOTS_EN: &str = "\
[Screenshots & Vision]
- cdp_screenshot: Capture the page content area; you can directly view the screenshot for visual assessment
- magic_capture_app_shell: Capture the full window (including browser tab bar and toolbar)
- Use screenshots for visual state assessment; use cdp_get_text or cdp_execute_js for precise data extraction
- Never use screenshots to extract text data — screenshots are for visual judgment only; text must be extracted via cdp_get_text / cdp_get_full_ax_tree / cdp_execute_js
- For SPA/dynamic page data: prefer cdp_get_full_ax_tree (semantic structure) or cdp_execute_js (custom JS batch extraction)";

const BASE_EXECUTION_EN: &str = "\
[Execution Mechanism]
- You must use tool calls to collect information and perform actions; do not guess
- You can call tools across multiple rounds to complete the task
- When ready to output the final result, you must call the submit_result tool with clean result data
- The result parameter of submit_result should only contain the result itself, without explanations, preambles, markers, or formatting";

const BASE_SAFETY_EN: &str = "\
[Safety Notes]
- Use delete and close operations with caution (app_delete_profile, magic_set_closed, file_write overwrite, etc.)
- Do not close or delete browser profiles without explicit instructions
- For `exec_command`, always use `command + args`; do not pass a whole shell string
- If a command is missing, prefer alternatives or install guidance instead of blind retries";

const BASE_MULTI_PROFILE_EN: &str = "\
[Multi-Profile Chats]
- `cdp_*` / `magic_*` always operate on the current tool target profile
- When multiple profiles are attached to the chat, call `app_set_chat_active_profile(profile_id)` before using browser tools
- `app_start_profile` only starts a profile and does not switch the current tool target automatically";

const BASE_CAPTCHA_CHAT_EN: &str = "\
[Captcha Handling]
- When encountering a captcha, first call `auto_list_captcha_configs` to check if a solving service is configured
- If a solving service is configured: follow the `captcha_detect` → `captcha_solve_and_inject` flow to solve automatically
- If no solving service is configured or auto-solving fails: use `dialog_message` to notify the user that manual intervention is needed for the captcha, and pause the current operation until the user resolves it
- `captcha_*` tools are successful only when the page has actually exited the captcha or anti-bot blocking state
- Receiving a token, filling a hidden field, or invoking a callback does not by itself mean the captcha passed
- If verification is still blocked, explicitly report the blockage instead of claiming completion
- Do not switch to DuckDuckGo or any other alternative site without the user's explicit permission just because captcha handling failed
- Identify the captcha type accurately before calling captcha_solve (slider ≠ reCAPTCHA ≠ hCaptcha)
- If captcha fails 3 consecutive times, stop automation and report the blockage to the user; do not keep retrying";

fn anti_loop_rules(locale: &str) -> String {
    use crate::services::agent_limits::{MAX_CONSECUTIVE_TOOL_FAILURES, MAX_SAME_ERROR_REPEATS};
    if locale.starts_with("en") {
        format!(
            "[Anti-Loop & Self-Assessment]\n\
             - If the same action (same tool + same arguments) fails or has no effect twice in a row, \
             switch to a completely different approach\n\
             - Every 5 tool-calling rounds, briefly review current progress and verify you are moving toward the goal\n\
             - If page screenshots or content are identical to the previous step, the action had no effect — change strategy immediately\n\
             - When a search box contains residual or garbled text, clear it via cdp_execute_js before typing, or navigate directly via URL\n\
             - Distinguish navigation links from filter controls: e-commerce filters are usually checkboxes or tag buttons; \
             take a screenshot after clicking to confirm the filter was applied\n\
             - If {MAX_CONSECUTIVE_TOOL_FAILURES} different approaches to the same goal have all failed, use `dialog_message` to report \
             the specific blocker to the user and request manual intervention; pause and wait instead of continuing to guess\n\
             - If the same error repeats {MAX_SAME_ERROR_REPEATS} times, escalate immediately via the appropriate dialog_* tool\n\
             - When encountering any problem that cannot be resolved automatically (insufficient permissions, expired login, \
             network errors, page anomalies, etc.), immediately use `dialog_message` to notify the user and request manual intervention"
        )
    } else {
        format!(
            "【防循环与自我评估】\n\
             - 同一操作（相同工具+相同参数）失败或无效 2 次后，必须切换到完全不同的方法\n\
             - 每执行 5 轮工具调用，简要回顾当前进展，确认是否朝目标前进\n\
             - 如果发现页面截图或内容与上次完全相同，说明操作没有效果，立即换策略\n\
             - 遇到搜索框有残留/乱码内容时，用 cdp_execute_js 清空后再重新输入，或直接通过 URL 访问目标页面\n\
             - 区分导航链接与筛选控件：电商网站的筛选通常是复选框或标签按钮，点击后要截图确认筛选状态是否生效\n\
             - 同一目标已尝试 {MAX_CONSECUTIVE_TOOL_FAILURES} 种不同方法均失败时，通过 `dialog_message` 向用户说明具体阻碍并申请人工介入，暂停等待用户指示\n\
             - 同一错误重复 {MAX_SAME_ERROR_REPEATS} 次时，立即通过合适的 dialog_* 工具升级处理\n\
             - 遇到任何无法自动解决的问题（权限不足、登录过期、网络异常、页面异常等），立即通过 `dialog_message` 通知用户并申请人工介入"
        )
    }
}

fn escalation_decision_tree(locale: &str) -> &'static str {
    if locale.starts_with("en") {
        "[Escalation Decision Tree]\n\
         When you must escalate to human intervention, choose by error type:\n\
         - Auth/login → dialog_confirm\n\
         - Captcha/anti-bot → dialog_image\n\
         - Network/timeout → dialog_countdown (auto_proceed=true)\n\
         - Intent unclear → dialog_input or dialog_select\n\
         - Completely blocked → dialog_toast(persistent=true, actions=[{\"label\":\"I'll handle it\",\"value\":\"takeover\"},{\"label\":\"Abort\",\"value\":\"abort\"}])"
    } else {
        "【升级决策树】\n\
         当必须升级人工介入时，按错误类型选对应 dialog_*：\n\
         - 权限/登录 → dialog_confirm\n\
         - 验证码/反爬 → dialog_image\n\
         - 网络/超时 → dialog_countdown（auto_proceed=true）\n\
         - 意图不清 → dialog_input 或 dialog_select\n\
         - 彻底阻塞 → dialog_toast(persistent=true, actions=[{\"label\":\"我来处理\",\"value\":\"takeover\"},{\"label\":\"放弃\",\"value\":\"abort\"}])"
    }
}

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
    ctx.push_str(if en { BASE_SAFETY_EN } else { BASE_SAFETY_ZH });
    ctx.push_str("\n\n");
    ctx.push_str(if en {
        BASE_CAPTCHA_CHAT_EN
    } else {
        BASE_CAPTCHA_CHAT_ZH
    });
    ctx.push_str("\n\n");
    ctx.push_str(if en {
        BASE_MULTI_PROFILE_EN
    } else {
        BASE_MULTI_PROFILE_ZH
    });
    ctx.push_str("\n\n");
    ctx.push_str(if en {
        "[Tool Failure Handling]\n\
         When a tool returns a result starting with `tool error:`, STOP the current plan and explain \
         the failure in plain language. In the next round issue at most ONE diagnostic or remediation \
         tool call (e.g. app_get_current_profile / app_list_profiles / app_get_running_profiles). \
         Never issue follow-up tools that depend on a previously failed tool's success in the same round."
    } else {
        "【工具失败处理】\n\
         当工具返回以 `tool error:` 开头的结果时，必须立即停止当前计划，用自然语言说明失败原因。\
         下一轮只发起至多 1 个用于诊断或补救的工具调用（如 app_get_current_profile / app_list_profiles / app_get_running_profiles）。\
         严禁在同一轮内继续发起依赖该失败工具成功的后续工具。"
    });
    ctx.push_str("\n\n");
    ctx.push_str(&anti_loop_rules(locale));
    ctx.push_str("\n\n");
    ctx.push_str(escalation_decision_tree(locale));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_prompt_includes_strict_captcha_guidance() {
        let prompt = build_chat_system_prompt(None, None, &[], "zh", None, None);

        assert!(prompt.contains("captcha_*"));
        assert!(prompt.contains("不等于页面已经通过验证"));
        assert!(prompt.contains("DuckDuckGo"));
    }

    #[test]
    fn chat_prompt_zh_includes_decision_tree() {
        let prompt = build_chat_system_prompt(None, None, &[], "zh", None, None);
        assert!(prompt.contains("dialog_confirm"));
        assert!(prompt.contains("dialog_image"));
        assert!(prompt.contains("dialog_countdown"));
        assert!(prompt.contains("dialog_toast"));
        assert!(prompt.contains("升级决策树"));
    }

    #[test]
    fn chat_prompt_en_includes_decision_tree() {
        let prompt = build_chat_system_prompt(None, None, &[], "en", None, None);
        assert!(prompt.contains("dialog_confirm"));
        assert!(prompt.contains("dialog_image"));
        assert!(prompt.contains("dialog_countdown"));
        assert!(prompt.contains("Escalation Decision Tree"));
    }

    #[test]
    fn anti_loop_rules_zh_uses_constants() {
        let rules = anti_loop_rules("zh");
        assert!(
            rules.contains('3'),
            "ZH anti-loop rules should mention threshold 3"
        );
    }

    #[test]
    fn anti_loop_rules_en_uses_constants() {
        let rules = anti_loop_rules("en");
        assert!(
            rules.contains('3'),
            "EN anti-loop rules should mention threshold 3"
        );
    }

    #[test]
    fn captcha_zh_aligned_with_en() {
        let zh = build_chat_system_prompt(None, None, &[], "zh", None, None);
        let en = build_chat_system_prompt(None, None, &[], "en", None, None);
        // Both should mention 3 consecutive failures for captcha
        assert!(zh.contains("连续失败 3 次") || zh.contains("3 次"));
        assert!(en.contains("3 consecutive times"));
    }
}
