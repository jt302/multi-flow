//! Agent 主循环的失败/停滞阈值。修改此文件等价于同步修改 prompt 文案。

/// 同一工具连续失败超过此次数时注入升级提示
pub const MAX_CONSECUTIVE_TOOL_FAILURES: u32 = 3;
/// 同一 (tool, error) 组合重复超过此次数时注入升级提示
pub const MAX_SAME_ERROR_REPEATS: u32 = 3;
/// 连续空转轮次超过此数值时注入升级提示
pub const MAX_CONSECUTIVE_EMPTY_ROUNDS: u32 = 2;
/// 连续工具调用但未产出任何 assistant 文本超过此轮次时，注入一次说明提醒
pub const MAX_ROUNDS_WITHOUT_ASSISTANT_TEXT: u32 = 12;

/// 用于 ai_prompts 注入的阈值摘要（中文）
#[cfg(test)]
pub fn format_zh() -> String {
    format!(
        "同一工具连续失败 {MAX_CONSECUTIVE_TOOL_FAILURES} 次 / \
         同一错误重复 {MAX_SAME_ERROR_REPEATS} 次 / \
         连续 {MAX_CONSECUTIVE_EMPTY_ROUNDS} 轮无产出 → 系统将注入升级提示，要求选择 dialog_* \
         / 连续 {MAX_ROUNDS_WITHOUT_ASSISTANT_TEXT} 轮只调工具不出文本 → 系统将注入说明提醒"
    )
}

/// 用于 ai_prompts 注入的阈值摘要（英文）
#[cfg(test)]
pub fn format_en() -> String {
    format!(
        "Same tool fails {MAX_CONSECUTIVE_TOOL_FAILURES} consecutive times / \
         same error repeats {MAX_SAME_ERROR_REPEATS} times / \
         {MAX_CONSECUTIVE_EMPTY_ROUNDS} consecutive empty rounds → \
         system will inject an escalation prompt requiring a dialog_* call \
         / {MAX_ROUNDS_WITHOUT_ASSISTANT_TEXT} consecutive rounds with tools but no assistant text → \
         system will inject a progress-report nudge"
    )
}

/// 构建工具连续失败升级提示（注入到 messages，让 LLM 自选 dialog_*，不强制 break）
pub fn build_escalation_prompt(
    tool_name: &str,
    failure_count: u32,
    last_errors: &[String],
    locale: &str,
) -> String {
    let en = locale.starts_with("en");
    let errors_summary = if last_errors.is_empty() {
        if en {
            "No error details available".to_string()
        } else {
            "无错误详情".to_string()
        }
    } else {
        last_errors
            .iter()
            .enumerate()
            .map(|(i, e)| format!("  {}. {}", i + 1, e))
            .collect::<Vec<_>>()
            .join("\n")
    };

    if en {
        format!(
            "⚠ Stall detected: tool `{tool_name}` has failed {failure_count} consecutive times.\n\
             \n\
             ## Observed Errors\n\
             {errors_summary}\n\
             \n\
             ## Required Next Step\n\
             Do NOT retry with the same approach. You MUST choose one of:\n\
             \n\
             (1) If you can try a completely different approach (different selector, different tool, \
             different entry point) → continue;\n\
             (2) If you are genuinely blocked → immediately call one of:\n\
             - Auth/login issue → dialog_confirm(\"Please log in again and let me know\")\n\
             - Captcha/anti-bot  → dialog_image(screenshot, \"Please enter the answer\")\n\
             - Network/timeout  → dialog_countdown(message, seconds=30, auto_proceed=true)\n\
             - Intent unclear   → dialog_input or dialog_select\n\
             - Completely blocked → dialog_toast(message, persistent=true, \
             actions=[{{\"label\":\"I'll handle it\",\"value\":\"takeover\"}},\
             {{\"label\":\"Abort\",\"value\":\"abort\"}}])\n\
             \n\
             NOT allowed: blind retries, silent responses, or pretending the problem is solved."
        )
    } else {
        format!(
            "⚠ 停滞检测：工具 `{tool_name}` 连续失败 {failure_count} 次。\n\
             \n\
             ## 已观察到的错误\n\
             {errors_summary}\n\
             \n\
             ## 下一步要求\n\
             不要继续用相同方法重试。必须二选一：\n\
             \n\
             (1) 若能换完全不同的思路（不同选择器、不同工具、不同入口）→ 继续；\n\
             (2) 若确实推不下去 → 立即调用以下之一：\n\
             - 权限/登录问题 → dialog_confirm(\"请重新登录并回来告诉我\")\n\
             - 验证码/反爬   → dialog_image(验证码截图, \"请输入答案\")\n\
             - 网络/超时     → dialog_countdown(message, seconds=30, auto_proceed=true)\n\
             - 需要澄清意图 → dialog_input / dialog_select\n\
             - 彻底阻塞     → dialog_toast(message, persistent=true, \
             actions=[{{\"label\":\"我来处理\",\"value\":\"takeover\"}},\
             {{\"label\":\"放弃\",\"value\":\"abort\"}}])\n\
             \n\
             不允许：继续盲试、静默回复、或假装问题已解决。"
        )
    }
}

/// 构建连续空轮升级提示
pub fn build_empty_rounds_prompt(count: u32, locale: &str) -> String {
    let en = locale.starts_with("en");
    if en {
        format!(
            "⚠ Stall detected: {count} consecutive rounds produced no tool calls or text output.\n\
             \n\
             You must immediately report your current status. Either:\n\
             - Explain what you have accomplished and what remains to be done, or\n\
             - Call a dialog_* tool to request human intervention if you are blocked\n\
             \n\
             Do not remain silent."
        )
    } else {
        format!(
            "⚠ 停滞检测：连续 {count} 轮无任何工具调用或文本输出。\n\
             \n\
             请立即汇报当前状态，必须执行以下之一：\n\
             - 说明已完成的内容和剩余工作，或\n\
             - 调用 dialog_* 工具申请人工介入（如果遇到阻碍）\n\
             \n\
             不允许继续沉默。"
        )
    }
}

/// 构建"长时间只调工具不出文本"说明提醒（注入到 messages 让 LLM 给出进度说明）
pub fn build_no_text_nudge_prompt(rounds: u32, locale: &str) -> String {
    let en = locale.starts_with("en");
    if en {
        format!(
            "⚠ Progress update required: you have called tools for {rounds} consecutive rounds \
             without producing any assistant text visible to the user.\n\
             \n\
             Please pause and write a short status update in the same language as the user:\n\
             - What have you accomplished so far?\n\
             - What is the current state of the page/task?\n\
             - What is your next step?\n\
             - Are you blocked by anything?\n\
             \n\
             After the update, you may continue with tool calls."
        )
    } else {
        format!(
            "⚠ 进度说明要求：你已连续 {rounds} 轮调用工具但未向用户输出任何文字说明。\n\
             \n\
             请暂停并用中文写一段简短的进度说明：\n\
             - 已完成了哪些步骤？\n\
             - 当前页面/任务处于什么状态？\n\
             - 下一步计划做什么？\n\
             - 是否遇到了障碍？\n\
             \n\
             说明完成后，可以继续调用工具。"
        )
    }
}

/// 构建空文本自救提示（模型返回空回复时注入，要求给出总结）
pub fn build_empty_text_recovery_prompt(locale: &str) -> String {
    let en = locale.starts_with("en");
    if en {
        "⚠ You just returned an empty response. This is not allowed.\n\
         \n\
         Please immediately write a response that includes:\n\
         - A summary of what you have done so far\n\
         - The current state of the page or task\n\
         - What the user needs to do next (if anything)\n\
         - If you are blocked, clearly state why and call a dialog_* tool\n\
         \n\
         Do not return an empty response again."
            .to_string()
    } else {
        "⚠ 你刚才返回了空回复，这是不允许的。\n\
         \n\
         请立即给出一段回复，内容包括：\n\
         - 你已经完成了哪些步骤\n\
         - 当前页面/任务处于什么状态\n\
         - 还需要用户做什么（如有）\n\
         - 如果遇到了障碍，请明确说明并调用 dialog_* 工具\n\
         \n\
         不允许再次返回空回复。"
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_zh_contains_thresholds() {
        let s = format_zh();
        assert!(s.contains('3'), "format_zh should mention threshold 3");
        assert!(s.contains('2'), "format_zh should mention threshold 2");
    }

    #[test]
    fn format_en_contains_thresholds() {
        let s = format_en();
        assert!(s.contains('3'), "format_en should mention threshold 3");
        assert!(s.contains('2'), "format_en should mention threshold 2");
    }

    #[test]
    fn escalation_prompt_zh_contains_dialog_options() {
        let p = build_escalation_prompt("file_read", 3, &["Permission denied".into()], "zh");
        assert!(p.contains("file_read"));
        assert!(p.contains("dialog_confirm"));
        assert!(p.contains("dialog_image"));
        assert!(p.contains("dialog_countdown"));
        assert!(p.contains("dialog_toast"));
        assert!(p.contains("Permission denied"));
    }

    #[test]
    fn escalation_prompt_en_contains_dialog_options() {
        let p = build_escalation_prompt("file_read", 3, &["Permission denied".into()], "en");
        assert!(p.contains("dialog_confirm"));
        assert!(p.contains("dialog_image"));
        assert!(p.contains("dialog_countdown"));
        assert!(p.contains("dialog_toast"));
    }

    #[test]
    fn empty_rounds_prompt_zh() {
        let p = build_empty_rounds_prompt(2, "zh");
        assert!(p.contains('2'));
        assert!(p.contains("dialog_*"));
    }

    #[test]
    fn empty_rounds_prompt_en() {
        let p = build_empty_rounds_prompt(2, "en");
        assert!(p.contains('2'));
        assert!(p.contains("dialog_*"));
    }
}
