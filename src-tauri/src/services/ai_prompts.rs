use crate::models::AiOutputKeyMapping;

/// Layer 1：基础上下文（核心原则部分，不含工具分类说明）
const BASE_CORE: &str = "\
你是一个浏览器自动化执行引擎，运行在 Multi-Flow 多配置文件浏览器管理系统中。你正在控制一个已打开的浏览器配置文件实例，浏览器中可能已有页面内容。

【核心原则】
你必须通过调用工具来完成任务。绝不要回复「我需要更多信息」或要求用户提供额外信息。
- 不确定页面状态？→ 调用 cdp_screenshot 查看
- 需要读取页面内容？→ 调用 cdp_get_text 或 cdp_execute_js
- 需要与页面交互？→ 调用 cdp_click、cdp_type 等
- 第一步通常是 cdp_screenshot 来了解当前页面状态";

/// 各工具类别描述
const TOOL_DESC_CDP: &str = "- cdp_*：页面交互（导航、点击、输入、获取文本、截图、执行JS等）";
const TOOL_DESC_MAGIC: &str =
    "- magic_*：浏览器窗口控制（窗口大小、标签管理、书签、Cookie、扩展等）";
const TOOL_DESC_APP: &str = "- app_*：应用数据查询与管理（配置文件、分组、代理等）";
const TOOL_DESC_FILE: &str = "- file_*：文件读写（受路径保护，10MB 限制）";
const TOOL_DESC_DIALOG: &str = "- dialog_*：用户交互弹窗（确认框、输入框、文件选择等）";
const TOOL_DESC_UTILITY: &str = "- wait / print：延时等待与日志输出";

const BASE_SCREENSHOTS: &str = "\
【截图与视觉】
- cdp_screenshot：截取页面内容区域，你可以直接看到截图内容进行视觉判断
- magic_capture_app_shell：截取完整窗口（包含浏览器标签栏和工具栏）
- 判断页面视觉状态时用截图；精确提取数据时用 cdp_get_text 或 cdp_execute_js";

const BASE_EXECUTION: &str = "\
【执行机制】
- 你必须通过工具调用来收集信息和执行操作，不要凭空猜测
- 可以连续多轮调用工具来完成任务
- 当准备好输出最终结果时，必须调用 submit_result 工具提交纯净的结果数据
- submit_result 的 result 参数只包含结果本身，不要包含解释、前言、标记或格式修饰";

const BASE_SAFETY: &str = "\
【安全注意】
- 慎用删除和关闭操作（app_delete_profile、magic_set_closed、file_write 覆盖等）
- 未经明确指示不要关闭或删除浏览器配置文件";

/// 根据已选工具类别构建 BASE_CONTEXT
/// 当 categories 为空时（全部启用），输出完整上下文；
/// 否则仅列出已选类别的工具说明，减少不相关的 token 消耗。
fn build_base_context(categories: &[String]) -> String {
    let mut ctx = BASE_CORE.to_string();
    ctx.push_str("\n\n【工具分类】\n");

    let all = categories.is_empty();
    if all || categories.iter().any(|c| c == "cdp") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_CDP);
    }
    if all || categories.iter().any(|c| c == "magic") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_MAGIC);
    }
    if all || categories.iter().any(|c| c == "app") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_APP);
    }
    if all || categories.iter().any(|c| c == "file") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_FILE);
    }
    if all || categories.iter().any(|c| c == "dialog") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_DIALOG);
    }
    if all || categories.iter().any(|c| c == "utility") {
        ctx.push('\n');
        ctx.push_str(TOOL_DESC_UTILITY);
    }

    ctx.push_str("\n\n");
    ctx.push_str(BASE_SCREENSHOTS);
    ctx.push_str("\n\n");
    ctx.push_str(BASE_EXECUTION);
    ctx.push_str("\n\n");
    ctx.push_str(BASE_SAFETY);
    ctx
}

/// 兼容旧调用：返回包含全部工具类别的基础上下文
pub fn base_context() -> String {
    build_base_context(&[])
}

/// 构建 AiAgent 完整系统提示词
///
/// 分层结构：基础上下文 → 用户自定义提示（可选）→ JSON 格式要求（可选）
/// `tool_categories` 空数组 = 全部工具；非空 = 仅列出对应类别说明
pub fn build_agent_system_prompt(
    user_system_prompt: Option<&str>,
    is_json: bool,
    output_key_map: &[AiOutputKeyMapping],
    tool_categories: &[String],
) -> String {
    let mut result = build_base_context(tool_categories);
    if let Some(sp) = user_system_prompt {
        result.push_str("\n\n");
        result.push_str(sp);
    }
    if is_json {
        result.push_str("\n\n");
        result.push_str(&build_json_instruction(output_key_map));
    }
    result
}

/// 构建 JSON 输出格式指令，当 output_key_map 非空时动态包含字段映射说明
fn build_json_instruction(output_key_map: &[AiOutputKeyMapping]) -> String {
    let mut s = String::from(
        "【输出格式要求】\n\
        当你完成所有工具调用并准备输出最终结果时，必须以合法的 JSON 对象格式回复。\n\
        - 不要包含 markdown 代码块标记\n\
        - 直接输出 JSON 对象，确保可被直接解析",
    );
    if !output_key_map.is_empty() {
        s.push_str("\n\n系统将从你的 JSON 输出中提取以下字段：\n");
        for m in output_key_map {
            s.push_str(&format!("- \"{}\" → 变量 {}\n", m.json_path, m.var_name));
        }
        s.push_str("请确保输出的 JSON 包含上述路径对应的字段。");
    }
    s
}

/// AiJudge boolean 模式系统提示词
pub fn judge_boolean_prompt(tool_categories: &[String]) -> String {
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
        build_base_context(tool_categories)
    )
}

/// AiJudge percentage 模式系统提示词
pub fn judge_percentage_prompt(tool_categories: &[String]) -> String {
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
        build_base_context(tool_categories)
    )
}
