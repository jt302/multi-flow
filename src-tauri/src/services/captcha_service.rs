//! CAPTCHA 求解服务 — 统一适配多家求解服务（2Captcha, CapSolver, Anti-Captcha, CapMonster）

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptchaType {
    RecaptchaV2,
    RecaptchaV2Invisible,
    RecaptchaV3,
    RecaptchaEnterprise,
    HCaptcha,
    CloudflareTurnstile,
    GeeTest,
    FunCaptcha,
    ImageToText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptchaTask {
    pub captcha_type: CaptchaType,
    pub website_url: String,
    #[serde(default)]
    pub website_key: String,
    pub page_action: Option<String>,
    #[serde(default)]
    pub is_invisible: bool,
    pub image_base64: Option<String>,
    pub gt: Option<String>,
    pub challenge: Option<String>,
    pub public_key: Option<String>,
    pub enterprise_payload: Option<Value>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptchaResult {
    pub token: String,
    pub user_agent: Option<String>,
    pub cost: Option<f64>,
    pub solve_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaSolverConfig {
    #[serde(default)]
    pub id: String,
    /// '2captcha' | 'capsolver' | 'anticaptcha' | 'capmonster'
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

/// 检测结果：页面上发现的 CAPTCHA info
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaDetectResult {
    #[serde(rename = "type")]
    pub captcha_type: Option<String>,
    pub sitekey: Option<String>,
    pub callback: Option<String>,
    pub page_action: Option<String>,
    #[serde(default)]
    pub is_invisible: bool,
    #[serde(default)]
    pub enterprise: bool,
    pub enterprise_payload: Option<Value>,
    pub user_agent: Option<String>,
    #[serde(default = "empty_json_object")]
    pub params: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaInjectionResult {
    #[serde(default)]
    pub field_injected: bool,
    #[serde(default)]
    pub injected_fields: Vec<String>,
    #[serde(default)]
    pub events_dispatched: usize,
    pub callback_name: Option<String>,
    #[serde(default)]
    pub callback_invoked: bool,
    #[serde(default)]
    pub callback_invocations: usize,
    #[serde(default)]
    pub form_submitted: bool,
    pub submit_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaPageState {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub title: String,
    pub ready_state: Option<String>,
    #[serde(default)]
    pub challenge_present: bool,
    #[serde(default)]
    pub captcha_widget_present: bool,
    #[serde(default)]
    pub token_present: bool,
    #[serde(default)]
    pub form_present: bool,
    #[serde(default)]
    pub blocking_indicators: Vec<String>,
    #[serde(default)]
    pub success_indicators: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaVerificationResult {
    #[serde(default)]
    pub verified: bool,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub challenge_present: bool,
    #[serde(default)]
    pub captcha_widget_present: bool,
    #[serde(default)]
    pub token_present: bool,
    #[serde(default)]
    pub callback_invoked: bool,
    #[serde(default)]
    pub form_submitted: bool,
    #[serde(default)]
    pub blocking_indicators: Vec<String>,
    #[serde(default)]
    pub success_indicators: Vec<String>,
}

fn empty_json_object() -> Value {
    json!({})
}

// ═══════════════════════════════════════════════════════════════════
// 服务实现
// ═══════════════════════════════════════════════════════════════════

pub struct CaptchaService {
    http: Client,
}

impl CaptchaService {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// CAPTCHA 检测 JS（注入到页面中执行）
    pub fn detection_js() -> &'static str {
        r#"(function detectCaptcha() {
            const result = {
                type: null,
                sitekey: null,
                callback: null,
                pageAction: null,
                isInvisible: false,
                enterprise: false,
                enterprisePayload: null,
                userAgent: navigator.userAgent,
                params: {}
            };
            const setIfMissing = (key, value) => {
                if (value === undefined || value === null || value === '') return;
                if (result[key] === null || result[key] === false) result[key] = value;
            };
            const setParam = (key, value) => {
                if (value === undefined || value === null || value === '') return;
                result.params[key] = value;
            };
            const collectUrlParams = (src) => {
                try {
                    const url = new URL(src, location.href);
                    setParam('apiDomain', url.hostname);
                    setIfMissing('sitekey', url.searchParams.get('k'));
                    setIfMissing('pageAction', url.searchParams.get('sa'));
                    const s = url.searchParams.get('s');
                    if (s) setParam('s', s);
                    if (url.pathname.includes('/enterprise/')) result.enterprise = true;
                } catch (_) {}
            };
            const collectRecaptchaAttrs = (el) => {
                if (!el || typeof el.getAttribute !== 'function') return;
                setIfMissing('sitekey', el.getAttribute('data-sitekey'));
                setIfMissing('callback', el.getAttribute('data-callback'));
                setIfMissing('pageAction', el.getAttribute('data-action'));
                const size = el.getAttribute('data-size');
                if (size) setParam('size', size);
                if (size === 'invisible') result.isInvisible = true;
                const dataS = el.getAttribute('data-s');
                if (dataS) setParam('s', dataS);
                const src = el.getAttribute('src');
                if (src) collectUrlParams(src);
            };
            document.querySelectorAll('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]').forEach((el) => {
                collectRecaptchaAttrs(el);
                if (!result.type) result.type = 'recaptcha_v2';
            });
            document.querySelectorAll('script[src*="recaptcha"]').forEach((el) => {
                collectUrlParams(el.getAttribute('src'));
            });
            const re = document.querySelector('.g-recaptcha, [data-sitekey]');
            if (re) {
                if (re.getAttribute('data-size') === 'invisible') {
                    result.type = 'recaptcha_v2_invisible';
                    result.isInvisible = true;
                } else if (!result.type) {
                    result.type = 'recaptcha_v2';
                }
            }
            if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
                result.type = 'recaptcha_enterprise';
                result.enterprise = true;
            }
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
                const seen = new WeakSet();
                const visit = (node, depth) => {
                    if (!node || depth > 6) return;
                    const nodeType = typeof node;
                    if ((nodeType === 'object' || nodeType === 'function') && seen.has(node)) return;
                    if (nodeType === 'object' || nodeType === 'function') seen.add(node);
                    if (Array.isArray(node)) {
                        node.forEach((item) => visit(item, depth + 1));
                        return;
                    }
                    if (nodeType !== 'object' && nodeType !== 'function') return;
                    Object.keys(node).forEach((key) => {
                        const value = node[key];
                        if (key === 'sitekey' && typeof value === 'string') setIfMissing('sitekey', value);
                        if (key === 'action' && typeof value === 'string') setIfMissing('pageAction', value);
                        if (key === 'size' && value === 'invisible') result.isInvisible = true;
                        if (key === 's' && typeof value === 'string') setParam('s', value);
                        if (key === 'callback' && typeof value === 'function' && value.name) setIfMissing('callback', value.name);
                        if (key === 'callback' && typeof value === 'string') setIfMissing('callback', value);
                        if ((key === 'enterprise' || key === 'isEnterprise') && value === true) result.enterprise = true;
                        visit(value, depth + 1);
                    });
                };
                visit(window.___grecaptcha_cfg.clients, 0);
            }
            if (result.params.s) {
                result.enterprisePayload = { s: result.params.s };
            }
            const hc = document.querySelector('.h-captcha, [data-hcaptcha-widget-id]');
            if (hc) { result.type = 'hcaptcha'; result.sitekey = hc.getAttribute('data-sitekey'); }
            const ts = document.querySelector('.cf-turnstile, [data-turnstile-widget-id]');
            if (ts) { result.type = 'turnstile'; result.sitekey = ts.getAttribute('data-sitekey'); }
            if (document.querySelector('.geetest_widget') || typeof initGeetest !== 'undefined') {
                result.type = 'geetest';
            }
            if (document.querySelector('#FunCaptcha') || typeof ArkoseEnforcement !== 'undefined') {
                result.type = 'funcaptcha';
            }
            if (document.title === 'Just a moment...' || document.querySelector('#challenge-form')) {
                result.type = 'cloudflare_challenge';
            }
            if (!result.type && result.sitekey) {
                result.type = result.enterprise
                    ? 'recaptcha_enterprise'
                    : (result.isInvisible ? 'recaptcha_v2_invisible' : 'recaptcha_v2');
            }
            return JSON.stringify(result);
        })()"#
    }

    pub fn injection_js_with_options(
        captcha_type: &str,
        token: &str,
        callback_name: Option<&str>,
        auto_submit: bool,
    ) -> String {
        let escaped = token.replace('\\', "\\\\").replace('\'', "\\'");
        let callback_json =
            serde_json::to_string(&callback_name).unwrap_or_else(|_| "null".to_string());
        match captcha_type {
            "recaptcha_v2" | "recaptcha_v3" | "recaptcha_enterprise" | "recaptcha" => format!(
                r#"(function() {{
                    const token = '{escaped}';
                    const explicitCallbackName = {callback_json};
                    const autoSubmit = {auto_submit};
                    const result = {{
                        fieldInjected: false,
                        injectedFields: [],
                        eventsDispatched: 0,
                        callbackName: explicitCallbackName,
                        callbackInvoked: false,
                        callbackInvocations: 0,
                        formSubmitted: false,
                        submitResult: null
                    }};
                    const setElementValue = (el, value) => {{
                        try {{
                            const proto = el.tagName === 'TEXTAREA'
                                ? HTMLTextAreaElement.prototype
                                : HTMLInputElement.prototype;
                            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                            if (desc && typeof desc.set === 'function') {{
                                desc.set.call(el, value);
                            }} else {{
                                el.value = value;
                            }}
                        }} catch (_) {{
                            el.value = value;
                        }}
                    }};
                    const dispatchEvents = (el) => {{
                        ['input', 'change'].forEach((type) => {{
                            el.dispatchEvent(new Event(type, {{ bubbles: true }}));
                            result.eventsDispatched += 1;
                        }});
                    }};
                    const markField = (el, fieldName) => {{
                        if (!el) return;
                        setElementValue(el, token);
                        el.style.display = 'block';
                        dispatchEvents(el);
                        result.fieldInjected = true;
                        if (!result.injectedFields.includes(fieldName)) {{
                            result.injectedFields.push(fieldName);
                        }}
                    }};
                    const resolvePath = (path) => {{
                        if (!path || typeof path !== 'string') return null;
                        return path.split('.').reduce((acc, part) => acc && acc[part], window);
                    }};
                    const invokeCallback = (fn, label) => {{
                        if (typeof fn !== 'function') return;
                        try {{
                            fn(token);
                            result.callbackInvoked = true;
                            result.callbackInvocations += 1;
                            if (!result.callbackName && label) result.callbackName = label;
                        }} catch (error) {{
                            result.submitResult = 'callback_error:' + (error && error.message ? error.message : String(error));
                        }}
                    }};
                    markField(document.getElementById('g-recaptcha-response'), 'g-recaptcha-response');
                    Array.from(document.querySelectorAll('[name="g-recaptcha-response"], textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]'))
                        .forEach((el) => markField(el, 'g-recaptcha-response'));
                    if (explicitCallbackName) {{
                        invokeCallback(resolvePath(explicitCallbackName), explicitCallbackName);
                    }}
                    if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {{
                        const seen = new WeakSet();
                        const invoked = new Set();
                        const visit = (node, depth) => {{
                            if (!node || depth > 6) return;
                            const nodeType = typeof node;
                            if ((nodeType === 'object' || nodeType === 'function') && seen.has(node)) return;
                            if (nodeType === 'object' || nodeType === 'function') seen.add(node);
                            if (Array.isArray(node)) {{
                                node.forEach((item) => visit(item, depth + 1));
                                return;
                            }}
                            if (nodeType !== 'object' && nodeType !== 'function') return;
                            Object.keys(node).forEach((key) => {{
                                const value = node[key];
                                if (key === 'callback' && typeof value === 'function' && !invoked.has(value)) {{
                                    invoked.add(value);
                                    invokeCallback(value, value.name || key);
                                }}
                                visit(value, depth + 1);
                            }});
                        }};
                        visit(window.___grecaptcha_cfg.clients, 0);
                    }}
                    const form = document.querySelector('form');
                    if ((autoSubmit || (!result.callbackInvoked && result.fieldInjected && form))) {{
                        try {{
                            if (form && typeof form.requestSubmit === 'function') {{
                                form.requestSubmit();
                                result.submitResult = 'requestSubmit';
                            }} else if (form) {{
                                form.submit();
                                result.submitResult = 'submit';
                            }} else {{
                                result.submitResult = 'no_form';
                            }}
                            result.formSubmitted = !!form;
                        }} catch (error) {{
                            result.submitResult = 'submit_error:' + (error && error.message ? error.message : String(error));
                        }}
                    }}
                    return JSON.stringify(result);
                }})()"#
            ),
            "hcaptcha" => format!(
                r#"(function() {{
                    const token = '{escaped}';
                    const result = {{
                        fieldInjected: false,
                        injectedFields: [],
                        eventsDispatched: 0,
                        callbackName: null,
                        callbackInvoked: false,
                        callbackInvocations: 0,
                        formSubmitted: false,
                        submitResult: null
                    }};
                    ['h-captcha-response', 'g-recaptcha-response'].forEach((name) => {{
                        document.querySelectorAll('[name="' + name + '"]').forEach((el) => {{
                            el.value = token;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            result.fieldInjected = true;
                            result.eventsDispatched += 2;
                            if (!result.injectedFields.includes(name)) result.injectedFields.push(name);
                        }});
                    }});
                    return JSON.stringify(result);
                }})()"#
            ),
            "turnstile" => format!(
                r#"(function() {{
                    const token = '{escaped}';
                    const result = {{
                        fieldInjected: false,
                        injectedFields: [],
                        eventsDispatched: 0,
                        callbackName: null,
                        callbackInvoked: false,
                        callbackInvocations: 0,
                        formSubmitted: false,
                        submitResult: null
                    }};
                    document.querySelectorAll('[name="cf-turnstile-response"]').forEach((el) => {{
                        el.value = token;
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        result.fieldInjected = true;
                        result.eventsDispatched += 2;
                        if (!result.injectedFields.includes('cf-turnstile-response')) {{
                            result.injectedFields.push('cf-turnstile-response');
                        }}
                    }});
                    return JSON.stringify(result);
                }})()"#
            ),
            _ => format!("'unsupported_type_{captcha_type}'"),
        }
    }

    pub fn verification_js() -> &'static str {
        r#"(function inspectCaptchaState() {
            const bodyText = (document.body && document.body.innerText ? document.body.innerText : '')
                .replace(/\s+/g, ' ')
                .trim();
            const lower = bodyText.toLowerCase();
            const blockingIndicators = [];
            const push = (condition, label) => { if (condition && !blockingIndicators.includes(label)) blockingIndicators.push(label); };
            push(location.pathname.includes('/sorry'), 'google_sorry_path');
            push(lower.includes('unusual traffic'), 'unusual traffic');
            push(lower.includes('our systems have detected unusual traffic'), 'google_unusual_traffic_copy');
            push(lower.includes('verify you are human'), 'verify you are human');
            push(lower.includes('not a robot'), 'not a robot');
            push(lower.includes('人机验证'), '人机验证');
            push(lower.includes('验证码'), '验证码');
            push(lower.includes('异常流量'), '异常流量');
            push(!!document.querySelector('#captcha-form, form[action*="sorry"], input[name="captcha"], textarea[name="captcha"]'), 'captcha_form');
            const tokenPresent = Array.from(document.querySelectorAll(
                '#g-recaptcha-response, [name="g-recaptcha-response"], [name="h-captcha-response"], [name="cf-turnstile-response"]'
            )).some((el) => !!(el.value && String(el.value).trim()));
            const captchaWidgetPresent = !!document.querySelector(
                '.g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="recaptcha"], iframe[title*="challenge"]'
            );
            const successIndicators = [];
            if (document.querySelector('#search, #rso')) successIndicators.push('google_search_results_visible');
            return JSON.stringify({
                url: location.href,
                title: document.title,
                readyState: document.readyState,
                challengePresent: blockingIndicators.length > 0,
                captchaWidgetPresent,
                tokenPresent,
                formPresent: !!document.querySelector('form'),
                blockingIndicators,
                successIndicators
            });
        })()"#
    }

    pub fn parse_detect_result(raw: &str) -> CaptchaDetectResult {
        serde_json::from_str::<CaptchaDetectResult>(raw).unwrap_or_default()
    }

    pub fn parse_injection_result(raw: &str) -> CaptchaInjectionResult {
        serde_json::from_str::<CaptchaInjectionResult>(raw).unwrap_or_default()
    }

    pub fn parse_page_state(raw: &str) -> CaptchaPageState {
        serde_json::from_str::<CaptchaPageState>(raw).unwrap_or_default()
    }

    pub fn classify_verification(
        page_state: &CaptchaPageState,
        injection: &CaptchaInjectionResult,
    ) -> CaptchaVerificationResult {
        let (verified, status, message) = if page_state.challenge_present {
            (
                false,
                "challenge_present".to_string(),
                "页面仍停留在验证码/风控拦截状态".to_string(),
            )
        } else if !page_state.success_indicators.is_empty()
            || injection.callback_invoked
            || injection.form_submitted
            || (!page_state.captcha_widget_present && page_state.token_present)
        {
            (
                true,
                "verified".to_string(),
                "页面已离开验证码阻塞状态".to_string(),
            )
        } else {
            (
                false,
                "pending_verification".to_string(),
                "已注入 token，但页面还没有出现通过验证的信号".to_string(),
            )
        };

        CaptchaVerificationResult {
            verified,
            status,
            message,
            url: page_state.url.clone(),
            title: page_state.title.clone(),
            challenge_present: page_state.challenge_present,
            captcha_widget_present: page_state.captcha_widget_present,
            token_present: page_state.token_present,
            callback_invoked: injection.callback_invoked,
            form_submitted: injection.form_submitted,
            blocking_indicators: page_state.blocking_indicators.clone(),
            success_indicators: page_state.success_indicators.clone(),
        }
    }

    pub fn is_user_agent_mismatch(
        browser_user_agent: Option<&str>,
        solver_user_agent: Option<&str>,
    ) -> bool {
        match (browser_user_agent, solver_user_agent) {
            (Some(browser), Some(solver)) => browser.trim() != solver.trim(),
            _ => false,
        }
    }

    /// 创建求解任务并轮询结果
    pub async fn solve(
        &self,
        config: &CaptchaSolverConfig,
        task: CaptchaTask,
    ) -> Result<CaptchaResult, String> {
        let base_url = self.provider_base_url(config);
        let task_body = self.build_create_task_body(config, &task)?;

        // 创建任务
        let resp = self
            .http
            .post(format!("{}/createTask", base_url))
            .json(&task_body)
            .send()
            .await
            .map_err(|e| format!("求解服务请求失败: {e}"))?;
        let result: Value = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {e}"))?;

        if result.get("errorId").and_then(|v| v.as_i64()).unwrap_or(0) != 0 {
            let desc = result["errorDescription"].as_str().unwrap_or("unknown");
            return Err(format!("创建任务失败: {desc}"));
        }

        let task_id = result["taskId"]
            .as_str()
            .or_else(|| result["taskId"].as_i64().map(|_| ""))
            .ok_or("响应中无 taskId")?;
        let task_id_val = if task_id.is_empty() {
            result["taskId"].as_i64().unwrap_or(0).to_string()
        } else {
            task_id.to_string()
        };

        // 轮询结果
        let start = std::time::Instant::now();
        for _ in 0..24 {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let poll_body = json!({
                "clientKey": config.api_key,
                "taskId": if config.provider == "2captcha" || config.provider == "capmonster" {
                    Value::Number(task_id_val.parse::<i64>().unwrap_or(0).into())
                } else {
                    Value::String(task_id_val.clone())
                },
            });
            let resp = self
                .http
                .post(format!("{}/getTaskResult", base_url))
                .json(&poll_body)
                .send()
                .await
                .map_err(|e| format!("轮询失败: {e}"))?;
            let result: Value = resp
                .json()
                .await
                .map_err(|e| format!("解析轮询响应失败: {e}"))?;

            if result["status"].as_str() == Some("ready") {
                let solution = &result["solution"];
                let token = solution["gRecaptchaResponse"]
                    .as_str()
                    .or(solution["token"].as_str())
                    .or(solution["text"].as_str())
                    .unwrap_or("")
                    .to_string();
                return Ok(CaptchaResult {
                    token,
                    user_agent: solution["userAgent"].as_str().map(String::from),
                    cost: result["cost"].as_str().and_then(|s| s.parse().ok()),
                    solve_time_ms: start.elapsed().as_millis() as u64,
                });
            }
            if result["errorId"].as_i64().unwrap_or(0) != 0 {
                let desc = result["errorDescription"].as_str().unwrap_or("unknown");
                return Err(format!("求解失败: {desc}"));
            }
        }
        Err("求解超时（120秒）".to_string())
    }

    /// 查询余额
    pub async fn get_balance(&self, config: &CaptchaSolverConfig) -> Result<f64, String> {
        let base_url = self.provider_base_url(config);
        let body = json!({ "clientKey": config.api_key });
        let resp = self
            .http
            .post(format!("{}/getBalance", base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("查询余额失败: {e}"))?;
        let result: Value = resp
            .json()
            .await
            .map_err(|e| format!("解析余额响应失败: {e}"))?;
        result["balance"].as_f64().ok_or_else(|| {
            result["errorDescription"]
                .as_str()
                .unwrap_or("unknown")
                .to_string()
        })
    }

    fn provider_base_url(&self, config: &CaptchaSolverConfig) -> String {
        if let Some(ref url) = config.base_url {
            if !url.is_empty() {
                return url.clone();
            }
        }
        match config.provider.as_str() {
            "2captcha" => "https://api.2captcha.com".to_string(),
            "capsolver" => "https://api.capsolver.com".to_string(),
            "anticaptcha" => "https://api.anti-captcha.com".to_string(),
            "capmonster" => "https://api.capmonster.cloud".to_string(),
            _ => "https://api.2captcha.com".to_string(),
        }
    }

    fn build_create_task_body(
        &self,
        config: &CaptchaSolverConfig,
        task: &CaptchaTask,
    ) -> Result<Value, String> {
        let task_type = self.map_task_type(config, task);
        let mut task_obj = json!({
            "type": task_type,
            "websiteURL": task.website_url,
            "websiteKey": task.website_key,
        });
        if let Some(ref action) = task.page_action {
            task_obj["pageAction"] = json!(action);
        }
        if task.is_invisible {
            task_obj["isInvisible"] = json!(true);
        }
        if let Some(ref img) = task.image_base64 {
            task_obj["body"] = json!(img);
        }
        if let Some(ref gt) = task.gt {
            task_obj["gt"] = json!(gt);
        }
        if let Some(ref challenge) = task.challenge {
            task_obj["challenge"] = json!(challenge);
        }
        if let Some(ref pk) = task.public_key {
            task_obj["websitePublicKey"] = json!(pk);
        }
        if let Some(ref payload) = task.enterprise_payload {
            match config.provider.as_str() {
                "2captcha" | "capsolver" | "anticaptcha" | "capmonster" => {
                    task_obj["enterprisePayload"] = payload.clone();
                }
                _ => {}
            }
        }
        if let Some(ref user_agent) = task.user_agent {
            if !matches!(task.captcha_type, CaptchaType::ImageToText) {
                task_obj["userAgent"] = json!(user_agent);
            }
        }
        Ok(json!({
            "clientKey": config.api_key,
            "task": task_obj,
        }))
    }

    fn map_task_type(&self, config: &CaptchaSolverConfig, task: &CaptchaTask) -> &'static str {
        let is_capsolver = config.provider == "capsolver";
        match task.captcha_type {
            CaptchaType::RecaptchaV2 => {
                if is_capsolver {
                    "ReCaptchaV2TaskProxyLess"
                } else {
                    "RecaptchaV2TaskProxyless"
                }
            }
            CaptchaType::RecaptchaV2Invisible => {
                if is_capsolver {
                    "ReCaptchaV2TaskProxyLess"
                } else {
                    "RecaptchaV2TaskProxyless"
                }
            }
            CaptchaType::RecaptchaV3 => {
                if is_capsolver {
                    "ReCaptchaV3TaskProxyLess"
                } else {
                    "RecaptchaV3TaskProxyless"
                }
            }
            CaptchaType::RecaptchaEnterprise => {
                if is_capsolver {
                    "ReCaptchaV2EnterpriseTaskProxyLess"
                } else {
                    "RecaptchaV2EnterpriseTaskProxyless"
                }
            }
            CaptchaType::HCaptcha => {
                if is_capsolver {
                    "HCaptchaTaskProxyLess"
                } else {
                    "HCaptchaTaskProxyless"
                }
            }
            CaptchaType::CloudflareTurnstile => {
                if is_capsolver {
                    "AntiTurnstileTaskProxyLess"
                } else {
                    "TurnstileTaskProxyless"
                }
            }
            CaptchaType::GeeTest => {
                if is_capsolver {
                    "GeeTestTaskProxyLess"
                } else {
                    "GeeTestTaskProxyless"
                }
            }
            CaptchaType::FunCaptcha => {
                if is_capsolver {
                    "FunCaptchaTaskProxyLess"
                } else {
                    "FunCaptchaTaskProxyless"
                }
            }
            CaptchaType::ImageToText => "ImageToTextTask",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn build_service() -> CaptchaService {
        CaptchaService::new(Client::new())
    }

    fn build_config(provider: &str) -> CaptchaSolverConfig {
        CaptchaSolverConfig {
            id: "cfg_1".into(),
            provider: provider.into(),
            api_key: "test-key".into(),
            base_url: None,
            is_default: true,
        }
    }

    #[test]
    fn build_create_task_body_includes_enterprise_payload_and_user_agent() {
        let service = build_service();
        let config = build_config("2captcha");
        let task = CaptchaTask {
            captcha_type: CaptchaType::RecaptchaEnterprise,
            website_url: "https://www.google.com/sorry/index".into(),
            website_key: "site-key".into(),
            page_action: Some("submit".into()),
            is_invisible: true,
            image_base64: None,
            gt: None,
            challenge: None,
            public_key: None,
            enterprise_payload: Some(json!({ "s": "enterprise-token" })),
            user_agent: Some("Mozilla/5.0 Test".into()),
        };

        let body = service
            .build_create_task_body(&config, &task)
            .expect("build task body");
        let task_obj = &body["task"];

        assert_eq!(task_obj["pageAction"], "submit");
        assert_eq!(task_obj["isInvisible"], true);
        assert_eq!(task_obj["enterprisePayload"]["s"], "enterprise-token");
        assert_eq!(task_obj["userAgent"], "Mozilla/5.0 Test");
    }

    #[test]
    fn classify_verification_fails_when_challenge_is_still_present() {
        let page_state = CaptchaPageState {
            url: "https://www.google.com/sorry/index".into(),
            title: "Google Search".into(),
            ready_state: Some("complete".into()),
            challenge_present: true,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec!["unusual traffic".into()],
            success_indicators: vec![],
        };
        let injection = CaptchaInjectionResult {
            field_injected: true,
            injected_fields: vec!["g-recaptcha-response".into()],
            events_dispatched: 2,
            callback_name: Some("submitCallback".into()),
            callback_invoked: true,
            callback_invocations: 1,
            form_submitted: true,
            submit_result: Some("submitted".into()),
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert_eq!(verification.status, "challenge_present");
    }

    #[test]
    fn classify_verification_requires_page_level_success_signal() {
        let page_state = CaptchaPageState {
            url: "https://example.com/login".into(),
            title: "Login".into(),
            ready_state: Some("complete".into()),
            challenge_present: false,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec![],
            success_indicators: vec![],
        };
        let injection = CaptchaInjectionResult {
            field_injected: true,
            injected_fields: vec!["g-recaptcha-response".into()],
            events_dispatched: 2,
            callback_name: None,
            callback_invoked: false,
            callback_invocations: 0,
            form_submitted: false,
            submit_result: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert_eq!(verification.status, "pending_verification");
    }

    #[test]
    fn classify_verification_passes_after_callback_without_blocking_challenge() {
        let page_state = CaptchaPageState {
            url: "https://example.com/login".into(),
            title: "Login".into(),
            ready_state: Some("complete".into()),
            challenge_present: false,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec![],
            success_indicators: vec!["callback_completed".into()],
        };
        let injection = CaptchaInjectionResult {
            field_injected: true,
            injected_fields: vec!["g-recaptcha-response".into()],
            events_dispatched: 2,
            callback_name: Some("submitCallback".into()),
            callback_invoked: true,
            callback_invocations: 1,
            form_submitted: false,
            submit_result: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(verification.verified);
        assert_eq!(verification.status, "verified");
    }
}
