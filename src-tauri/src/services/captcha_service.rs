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
    pub cookies: Option<String>,
    pub proxy: Option<CaptchaProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CaptchaProxyConfig {
    pub proxy_type: String,
    pub proxy_address: String,
    pub proxy_port: i32,
    pub proxy_login: Option<String>,
    pub proxy_password: Option<String>,
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
    pub gt: Option<String>,
    pub challenge: Option<String>,
    pub public_key: Option<String>,
    #[serde(default)]
    pub is_invisible: bool,
    #[serde(default)]
    pub enterprise: bool,
    pub enterprise_payload: Option<Value>,
    pub user_agent: Option<String>,
    #[serde(default = "empty_json_object")]
    pub params: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
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
    /// 注入侧 `___grecaptcha_cfg.clients` 深度优先搜索的诊断信息：
    /// `{ visitedNodes, anonymousFound, namedFound[] }`。
    /// 仅作透传，Rust 侧不做强解析。
    pub callback_search: Option<Value>,
}

/// `submit_click_js` 的解析结果
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubmitClickResult {
    #[serde(default)]
    pub clicked: bool,
    pub label: Option<String>,
    pub selector: Option<String>,
    #[serde(default)]
    pub candidates: usize,
    pub error: Option<String>,
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
    /// 软成功：token 已注入但页面尚未给出通过信号；调用方应据此尝试点击 Submit/Verify 按钮，
    /// 而不是把整个工具调用判为失败、触发重新求解（会消耗 2captcha 等服务的配额）。
    #[serde(default)]
    pub soft_success: bool,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub message: String,
    pub next_action_hint: Option<String>,
    #[serde(default)]
    pub submit_attempted: bool,
    pub submit_clicked_label: Option<String>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TaskIdWireType {
    Number,
    String,
}

#[derive(Debug, Clone, Copy)]
struct ProviderSpec {
    default_base_url: &'static str,
    poll_task_id_type: TaskIdWireType,
    supports_sync_ready: bool,
}

impl ProviderSpec {
    fn for_provider(provider: &str) -> Self {
        match provider {
            "capsolver" => Self {
                default_base_url: "https://api.capsolver.com",
                poll_task_id_type: TaskIdWireType::String,
                supports_sync_ready: true,
            },
            "anticaptcha" => Self {
                default_base_url: "https://api.anti-captcha.com",
                poll_task_id_type: TaskIdWireType::Number,
                supports_sync_ready: false,
            },
            "capmonster" => Self {
                default_base_url: "https://api.capmonster.cloud",
                poll_task_id_type: TaskIdWireType::Number,
                supports_sync_ready: false,
            },
            _ => Self {
                default_base_url: "https://api.2captcha.com",
                poll_task_id_type: TaskIdWireType::Number,
                supports_sync_ready: false,
            },
        }
    }
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
                gt: null,
                challenge: null,
                publicKey: null,
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
                let nodesVisited = 0;
                const NODES_CAP = 5000;
                const DEPTH_CAP = 10;
                const visit = (node, depth) => {
                    if (!node || depth > DEPTH_CAP || nodesVisited > NODES_CAP) return;
                    nodesVisited++;
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
                        // 命名回调：直接记录函数名，让注入侧用 resolvePath 重新拿到
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
                const gtEl = document.querySelector('[data-gt], input[name="gt"]');
                const challengeEl = document.querySelector('[data-challenge], input[name="challenge"]');
                if (gtEl) setIfMissing('gt', gtEl.getAttribute('data-gt') || gtEl.value);
                if (challengeEl) setIfMissing('challenge', challengeEl.getAttribute('data-challenge') || challengeEl.value);
            }
            if (document.querySelector('#FunCaptcha') || typeof ArkoseEnforcement !== 'undefined') {
                result.type = 'funcaptcha';
                const fc = document.querySelector('#FunCaptcha, [data-pkey], [data-public-key]');
                if (fc) setIfMissing('publicKey', fc.getAttribute('data-pkey') || fc.getAttribute('data-public-key'));
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
                        let nodesVisited = 0;
                        let anonymousFound = 0;
                        const namedFound = [];
                        const NODES_CAP = 5000;
                        const DEPTH_CAP = 10;
                        const visit = (node, depth) => {{
                            if (!node || depth > DEPTH_CAP || nodesVisited > NODES_CAP) return;
                            nodesVisited++;
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
                                // 接受所有 callback 函数，无论是否具名（匿名 callback 也可调用）
                                if (key === 'callback' && typeof value === 'function' && !invoked.has(value)) {{
                                    invoked.add(value);
                                    if (value.name) {{
                                        namedFound.push(value.name);
                                    }} else {{
                                        anonymousFound++;
                                    }}
                                    invokeCallback(value, value.name || key);
                                }}
                                visit(value, depth + 1);
                            }});
                        }};
                        visit(window.___grecaptcha_cfg.clients, 0);
                        // 暴露搜索诊断信息，便于问题排查
                        result.callbackSearch = {{
                            visitedNodes: nodesVisited,
                            anonymousFound: anonymousFound,
                            namedFound: namedFound
                        }};
                    }}
                    const form = document.querySelector('form');
                    if (autoSubmit && form) {{
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

    /// 生成 JS 用于在页面中查找并点击 Submit/Verify/Check 按钮。
    ///
    /// 仅在已注入 token 但页面未给出通过信号时使用，目的是替代用户的"提交"动作。
    /// 优先级：用户自定义提示 > input/button[type=submit] > 文本匹配 Verify/Check/Submit/中文。
    /// 排除位于 reCAPTCHA / hCaptcha / Turnstile widget 内部的按钮，避免误点 widget
    /// 自身的"我不是机器人"按钮。返回 JSON `{ clicked, label, selector, candidates }`。
    pub fn submit_click_js(extra_hints: &[String]) -> String {
        // 序列化用户自定义按钮文本（最高优先级）
        let hints_json =
            serde_json::to_string(extra_hints).unwrap_or_else(|_| "[]".to_string());
        format!(
            r#"(function clickSubmitButton() {{
                const userHints = {hints_json};
                // 文本匹配关键词（按优先级，分大小写不敏感）。包含中英常见提交按钮文本。
                const PRIORITY_KEYWORDS = [
                    'verify', 'check', 'submit', '验证', '确认', '提交',
                    'continue', 'next', '下一步'
                ];
                // 排除选择器：reCAPTCHA / hCaptcha / Turnstile widget 自身的按钮
                const EXCLUDE_SELECTORS = [
                    '.g-recaptcha', '.h-captcha', '.cf-turnstile',
                    'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
                    'iframe[title*="recaptcha"]', 'iframe[title*="challenge"]'
                ];

                const isExcluded = (el) => {{
                    for (const sel of EXCLUDE_SELECTORS) {{
                        if (el.closest && el.closest(sel)) return true;
                    }}
                    return false;
                }};
                const isClickable = (el) => {{
                    if (!el) return false;
                    if (el.disabled) return false;
                    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
                    // offsetParent==null 表示元素不可见（display:none 或祖先 display:none）
                    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
                    return true;
                }};
                const elementText = (el) => {{
                    const v = (el.value || el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
                    return v;
                }};
                const cssPath = (el) => {{
                    if (!el) return null;
                    if (el.id) return '#' + el.id;
                    const tag = el.tagName ? el.tagName.toLowerCase() : '';
                    const cls = (el.className && typeof el.className === 'string')
                        ? '.' + el.className.trim().split(/\s+/).join('.') : '';
                    return tag + cls;
                }};

                // 候选打分：用户提示=100，type=submit=80，关键词命中按优先级 60-10
                const score = (el) => {{
                    if (isExcluded(el) || !isClickable(el)) return -1;
                    const text = elementText(el).toLowerCase();
                    const type = (el.getAttribute && (el.getAttribute('type') || '')).toLowerCase();
                    let s = 0;
                    if (text) {{
                        for (const hint of userHints) {{
                            if (text.includes(String(hint).toLowerCase())) {{ s = Math.max(s, 100); break; }}
                        }}
                    }}
                    if (type === 'submit') s = Math.max(s, 80);
                    PRIORITY_KEYWORDS.forEach((kw, idx) => {{
                        if (text && text.includes(kw)) {{
                            s = Math.max(s, 60 - idx * 5);
                        }}
                    }});
                    return s > 0 ? s : -1;
                }};

                // 收集候选：button、input[type=submit/button]、[role=button]
                const candidates = [];
                document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')
                    .forEach((el) => {{
                        const sc = score(el);
                        if (sc > 0) {{
                            candidates.push({{ el, score: sc, text: elementText(el).slice(0, 60) }});
                        }}
                    }});
                candidates.sort((a, b) => b.score - a.score);

                if (candidates.length === 0) {{
                    return JSON.stringify({{ clicked: false, label: null, selector: null, candidates: 0 }});
                }}

                const top = candidates[0];
                try {{
                    top.el.click();
                }} catch (err) {{
                    return JSON.stringify({{
                        clicked: false,
                        label: top.text,
                        selector: cssPath(top.el),
                        candidates: candidates.length,
                        error: String(err && err.message || err)
                    }});
                }}
                return JSON.stringify({{
                    clicked: true,
                    label: top.text,
                    selector: cssPath(top.el),
                    candidates: candidates.length
                }});
            }})()"#
        )
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

    pub fn parse_submit_click_result(raw: &str) -> SubmitClickResult {
        serde_json::from_str::<SubmitClickResult>(raw).unwrap_or_default()
    }

    /// 判断 blocking_indicators 是否包含"强阻塞"信号——这些信号表明页面被真实拦截
    /// （如 Google sorry 页面、Cloudflare 异常流量页面），与单纯的 widget 文本（如
    /// "not a robot"）相区分。后者会出现在所有正常的 reCAPTCHA v2 演示页面中，不能
    /// 据此判定页面被拦截。
    fn has_strong_blocking(indicators: &[String]) -> bool {
        indicators.iter().any(|i| {
            matches!(
                i.as_str(),
                "google_sorry_path"
                    | "unusual traffic"
                    | "google_unusual_traffic_copy"
                    | "异常流量"
                    | "captcha_form"
            )
        })
    }

    pub fn classify_verification(
        page_state: &CaptchaPageState,
        injection: &CaptchaInjectionResult,
    ) -> CaptchaVerificationResult {
        // 状态机判定优先级：
        //   1. 注入彻底失败（field_injected=false） → injection_failed（硬失败）
        //   2. 强阻塞信号存在（真实风控拦截） → challenge_present（硬失败，无论是否注入）
        //   3. 已经满足任一通过信号 → verified（成功）
        //   4. token 已写入字段且事件已派发 → token_injected（软成功，等待外部点击 Submit）
        //   5. 兜底 → pending_verification
        // 关键修正：原实现把 challenge_present 当作"任意 blocking_indicators 非空"，
        //   导致 2captcha demo 等含 "not a robot" 文本的正常页面被误判为拦截。
        //   这里把"强阻塞"与"弱阻塞（widget 文本）"区分开。
        let strong_blocking = Self::has_strong_blocking(&page_state.blocking_indicators);
        let (verified, soft_success, status, message, hint) =
            if !injection.field_injected {
                (
                    false,
                    false,
                    "injection_failed".to_string(),
                    "JS 注入失败：g-recaptcha-response 等字段未被设置".to_string(),
                    None,
                )
            } else if strong_blocking {
                (
                    false,
                    false,
                    "challenge_present".to_string(),
                    "页面仍停留在验证码/风控拦截状态".to_string(),
                    None,
                )
            } else if !page_state.success_indicators.is_empty()
                || injection.callback_invoked
                || injection.form_submitted
                || (!page_state.captcha_widget_present && page_state.token_present)
            {
                (
                    true,
                    false,
                    "verified".to_string(),
                    "页面已离开验证码阻塞状态".to_string(),
                    None,
                )
            } else if injection.events_dispatched > 0 {
                (
                    false,
                    true,
                    "token_injected".to_string(),
                    "token 已注入字段但页面尚未给出通过信号，建议点击页面 Submit/Verify 按钮"
                        .to_string(),
                    Some("click_submit_button".to_string()),
                )
            } else {
                (
                    false,
                    false,
                    "pending_verification".to_string(),
                    "已注入 token，但页面还没有出现通过验证的信号".to_string(),
                    None,
                )
            };

        CaptchaVerificationResult {
            verified,
            soft_success,
            status,
            message,
            next_action_hint: hint,
            submit_attempted: false,
            submit_clicked_label: None,
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
        let spec = ProviderSpec::for_provider(&config.provider);
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

        let start = std::time::Instant::now();
        if spec.supports_sync_ready && result["status"].as_str() == Some("ready") {
            return self.result_from_ready_response(&result, start.elapsed());
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
        for _ in 0..24 {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let poll_body = json!({
                "clientKey": config.api_key,
                "taskId": if spec.poll_task_id_type == TaskIdWireType::Number {
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

            if result["errorId"].as_i64().unwrap_or(0) != 0 {
                let desc = result["errorDescription"].as_str().unwrap_or("unknown");
                return Err(format!("求解失败: {desc}"));
            }
            if result["status"].as_str() == Some("ready") {
                return self.result_from_ready_response(&result, start.elapsed());
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
        ProviderSpec::for_provider(&config.provider)
            .default_base_url
            .to_string()
    }

    fn result_from_ready_response(
        &self,
        result: &Value,
        elapsed: std::time::Duration,
    ) -> Result<CaptchaResult, String> {
        let solution = &result["solution"];
        let token = solution["gRecaptchaResponse"]
            .as_str()
            .or(solution["token"].as_str())
            .or(solution["text"].as_str())
            .or(solution["captchaSolve"].as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                "求解服务返回 ready，但 solution token 为空（empty solution token）".to_string()
            })?
            .to_string();
        let cost = result["cost"]
            .as_f64()
            .or_else(|| result["cost"].as_str().and_then(|s| s.parse().ok()));
        Ok(CaptchaResult {
            token,
            user_agent: solution["userAgent"].as_str().map(String::from),
            cost,
            solve_time_ms: elapsed.as_millis() as u64,
        })
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
            task_obj["publicKey"] = json!(pk);
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
        if config.provider == "capmonster" {
            if let Some(ref cookies) = task.cookies {
                if !cookies.trim().is_empty() {
                    task_obj["cookies"] = json!(cookies);
                }
            }
            if let Some(ref proxy) = task.proxy {
                task_obj["proxyType"] = json!(proxy.proxy_type);
                task_obj["proxyAddress"] = json!(proxy.proxy_address);
                task_obj["proxyPort"] = json!(proxy.proxy_port);
                if let Some(ref login) = proxy.proxy_login {
                    if !login.trim().is_empty() {
                        task_obj["proxyLogin"] = json!(login);
                    }
                }
                if let Some(ref password) = proxy.proxy_password {
                    task_obj["proxyPassword"] = json!(password);
                }
            }
        }
        Ok(json!({
            "clientKey": config.api_key,
            "task": task_obj,
        }))
    }

    fn map_task_type(&self, config: &CaptchaSolverConfig, task: &CaptchaTask) -> &'static str {
        let provider = config.provider.as_str();
        match task.captcha_type {
            CaptchaType::RecaptchaV2 | CaptchaType::RecaptchaV2Invisible => match provider {
                "capsolver" => "ReCaptchaV2TaskProxyLess",
                "capmonster" => "RecaptchaV2Task",
                _ => "RecaptchaV2TaskProxyless",
            },
            CaptchaType::RecaptchaV3 => match provider {
                "capsolver" => "ReCaptchaV3TaskProxyLess",
                "capmonster" => "RecaptchaV3TaskProxyless",
                _ => "RecaptchaV3TaskProxyless",
            },
            CaptchaType::RecaptchaEnterprise => match provider {
                "capsolver" => "ReCaptchaV2EnterpriseTaskProxyLess",
                "capmonster" => "RecaptchaV2EnterpriseTask",
                _ => "RecaptchaV2EnterpriseTaskProxyless",
            },
            CaptchaType::HCaptcha => match provider {
                "capsolver" => "HCaptchaTaskProxyLess",
                "capmonster" => "HCaptchaTask",
                _ => "HCaptchaTaskProxyless",
            },
            CaptchaType::CloudflareTurnstile => match provider {
                "capsolver" => "AntiTurnstileTaskProxyLess",
                "capmonster" => "TurnstileTask",
                _ => "TurnstileTaskProxyless",
            },
            CaptchaType::GeeTest => match provider {
                "capsolver" => "GeeTestTaskProxyLess",
                "capmonster" => "GeeTestTask",
                _ => "GeeTestTaskProxyless",
            },
            CaptchaType::FunCaptcha => match provider {
                "capmonster" => "FunCaptchaTask",
                _ => "FunCaptchaTaskProxyless",
            },
            CaptchaType::ImageToText => "ImageToTextTask",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{extract::State, routing::post, Json, Router};
    use serde_json::json;
    use std::sync::{Arc, Mutex};

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

    fn build_config_with_base_url(provider: &str, base_url: String) -> CaptchaSolverConfig {
        CaptchaSolverConfig {
            base_url: Some(base_url),
            ..build_config(provider)
        }
    }

    fn token_task(captcha_type: CaptchaType) -> CaptchaTask {
        CaptchaTask {
            captcha_type,
            website_url: "https://example.com/login".into(),
            website_key: "site-key".into(),
            page_action: Some("submit".into()),
            is_invisible: false,
            image_base64: None,
            gt: Some("gt-value".into()),
            challenge: Some("challenge-value".into()),
            public_key: Some("public-key".into()),
            enterprise_payload: Some(json!({ "s": "enterprise-token" })),
            user_agent: Some("Mozilla/5.0 Test".into()),
            cookies: None,
            proxy: None,
        }
    }

    #[derive(Clone)]
    struct MockCaptchaApiState {
        requests: Arc<Mutex<Vec<Value>>>,
        responses: Arc<Mutex<Vec<Value>>>,
    }

    async fn mock_captcha_handler(
        State(state): State<MockCaptchaApiState>,
        Json(body): Json<Value>,
    ) -> Json<Value> {
        state.requests.lock().expect("requests lock").push(body);
        let response = state.responses.lock().expect("responses lock").remove(0);
        Json(response)
    }

    async fn spawn_mock_captcha_api(responses: Vec<Value>) -> (String, Arc<Mutex<Vec<Value>>>) {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let state = MockCaptchaApiState {
            requests: requests.clone(),
            responses: Arc::new(Mutex::new(responses)),
        };
        let app = Router::new()
            .route("/createTask", post(mock_captcha_handler))
            .route("/getTaskResult", post(mock_captcha_handler))
            .with_state(state);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock captcha api");
        let addr = listener.local_addr().expect("mock api addr");
        tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("serve mock captcha api");
        });
        (format!("http://{addr}"), requests)
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
            cookies: None,
            proxy: None,
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
    fn build_create_task_body_maps_provider_specific_task_types() {
        let service = build_service();
        let cases = [
            (
                "2captcha",
                CaptchaType::RecaptchaV2,
                "RecaptchaV2TaskProxyless",
            ),
            (
                "capsolver",
                CaptchaType::RecaptchaV2,
                "ReCaptchaV2TaskProxyLess",
            ),
            (
                "anticaptcha",
                CaptchaType::RecaptchaV2,
                "RecaptchaV2TaskProxyless",
            ),
            ("capmonster", CaptchaType::RecaptchaV2, "RecaptchaV2Task"),
            (
                "capmonster",
                CaptchaType::CloudflareTurnstile,
                "TurnstileTask",
            ),
            ("capmonster", CaptchaType::FunCaptcha, "FunCaptchaTask"),
        ];

        for (provider, captcha_type, expected_type) in cases {
            let body = service
                .build_create_task_body(&build_config(provider), &token_task(captcha_type))
                .expect("build task body");

            assert_eq!(
                body["task"]["type"], expected_type,
                "provider {provider} should use {expected_type}"
            );
        }
    }

    #[test]
    fn capmonster_create_task_body_includes_browser_context() {
        let service = build_service();
        let config = build_config("capmonster");
        let mut task = token_task(CaptchaType::RecaptchaV2);
        task.cookies = Some("sid=abc; pref=zh".into());
        task.proxy = Some(CaptchaProxyConfig {
            proxy_type: "http".into(),
            proxy_address: "127.0.0.1".into(),
            proxy_port: 8080,
            proxy_login: Some("user".into()),
            proxy_password: Some("pass".into()),
        });

        let body = service
            .build_create_task_body(&config, &task)
            .expect("build capmonster body");
        let task_obj = &body["task"];

        assert_eq!(task_obj["type"], "RecaptchaV2Task");
        assert_eq!(task_obj["cookies"], "sid=abc; pref=zh");
        assert_eq!(task_obj["proxyType"], "http");
        assert_eq!(task_obj["proxyAddress"], "127.0.0.1");
        assert_eq!(task_obj["proxyPort"], 8080);
        assert_eq!(task_obj["proxyLogin"], "user");
        assert_eq!(task_obj["proxyPassword"], "pass");
    }

    #[test]
    fn recaptcha_injection_respects_auto_submit_false() {
        let js = CaptchaService::injection_js_with_options("recaptcha_v2", "token", None, false);

        assert!(js.contains("if (autoSubmit && form)"));
        assert!(!js.contains("!result.callbackInvoked && result.fieldInjected && form"));
    }

    #[tokio::test]
    async fn solve_returns_synchronous_ready_solution_from_capsolver() {
        let (base_url, requests) = spawn_mock_captcha_api(vec![json!({
            "errorId": 0,
            "status": "ready",
            "taskId": "task-sync",
            "solution": {
                "gRecaptchaResponse": "token-sync",
                "userAgent": "solver-ua"
            },
            "cost": "0.0012"
        })])
        .await;
        let service = build_service();
        let config = build_config_with_base_url("capsolver", base_url);

        let result = service
            .solve(&config, token_task(CaptchaType::RecaptchaV2))
            .await
            .expect("sync ready solution");

        assert_eq!(result.token, "token-sync");
        assert_eq!(result.user_agent.as_deref(), Some("solver-ua"));
        assert_eq!(result.cost, Some(0.0012));
        assert_eq!(requests.lock().expect("requests lock").len(), 1);
    }

    #[tokio::test]
    async fn solve_polls_processing_until_ready() {
        let (base_url, requests) = spawn_mock_captcha_api(vec![
            json!({ "errorId": 0, "taskId": 123 }),
            json!({ "errorId": 0, "status": "processing" }),
            json!({
                "errorId": 0,
                "status": "ready",
                "solution": { "token": "turnstile-token" },
                "cost": 0.002
            }),
        ])
        .await;
        let service = build_service();
        let config = build_config_with_base_url("2captcha", base_url);

        let result = service
            .solve(&config, token_task(CaptchaType::CloudflareTurnstile))
            .await
            .expect("polled ready solution");

        assert_eq!(result.token, "turnstile-token");
        assert_eq!(result.cost, Some(0.002));
        let requests = requests.lock().expect("requests lock");
        assert_eq!(requests.len(), 3);
        assert_eq!(requests[1]["taskId"], 123);
    }

    #[tokio::test]
    async fn solve_returns_provider_error_from_poll_response() {
        let (base_url, _requests) = spawn_mock_captcha_api(vec![
            json!({ "errorId": 0, "taskId": 123 }),
            json!({
                "errorId": 12,
                "errorCode": "ERROR_CAPTCHA_UNSOLVABLE",
                "errorDescription": "Workers could not solve the Captcha"
            }),
        ])
        .await;
        let service = build_service();
        let config = build_config_with_base_url("2captcha", base_url);

        let err = service
            .solve(&config, token_task(CaptchaType::RecaptchaV2))
            .await
            .expect_err("provider error");

        assert!(err.contains("Workers could not solve the Captcha"));
    }

    #[tokio::test]
    async fn solve_rejects_ready_response_without_token() {
        let (base_url, _requests) = spawn_mock_captcha_api(vec![
            json!({ "errorId": 0, "taskId": 123 }),
            json!({
                "errorId": 0,
                "status": "ready",
                "solution": {}
            }),
        ])
        .await;
        let service = build_service();
        let config = build_config_with_base_url("2captcha", base_url);

        let err = service
            .solve(&config, token_task(CaptchaType::RecaptchaV2))
            .await
            .expect_err("empty token should fail");

        assert!(err.contains("empty solution token"));
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
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert_eq!(verification.status, "challenge_present");
    }

    #[test]
    fn classify_verification_returns_token_injected_when_only_field_set() {
        // 场景：reCAPTCHA v2 普通模式，token 已注入字段，事件已派发，但页面没有强阻塞，
        // 也没有 callback/form 信号——这是 2captcha demo 的典型情形。
        // 期望：返回 token_injected（软成功），调用方据此点击 Submit/Verify 按钮，
        // 而不是被判为 pending_verification 并触发上层重新求解。
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
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert!(verification.soft_success);
        assert_eq!(verification.status, "token_injected");
        assert_eq!(
            verification.next_action_hint.as_deref(),
            Some("click_submit_button")
        );
    }

    #[test]
    fn classify_verification_token_injected_when_widget_text_present_only() {
        // 场景：2captcha demo 页面包含 "I'm not a robot" 字样（弱 blocking 指标），
        // 旧逻辑会因 challenge_present=true 误判为硬失败；新逻辑应识别这是 widget
        // 文本而非真实风控拦截，返回 token_injected。
        let page_state = CaptchaPageState {
            url: "https://2captcha.com/demo/recaptcha-v2".into(),
            title: "reCAPTCHA v2 demo".into(),
            ready_state: Some("complete".into()),
            challenge_present: true,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec!["not a robot".into(), "verify you are human".into()],
            success_indicators: vec![],
        };
        let injection = CaptchaInjectionResult {
            field_injected: true,
            injected_fields: vec!["g-recaptcha-response".into()],
            events_dispatched: 4,
            callback_name: None,
            callback_invoked: false,
            callback_invocations: 0,
            form_submitted: false,
            submit_result: None,
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert!(verification.soft_success);
        assert_eq!(verification.status, "token_injected");
    }

    #[test]
    fn classify_verification_returns_injection_failed_when_field_not_set() {
        // 场景：JS 注入彻底失败，无论页面状态如何，工具都应硬失败。
        let page_state = CaptchaPageState {
            url: "https://example.com/login".into(),
            title: "Login".into(),
            ready_state: Some("complete".into()),
            challenge_present: false,
            captcha_widget_present: true,
            token_present: false,
            form_present: true,
            blocking_indicators: vec![],
            success_indicators: vec![],
        };
        let injection = CaptchaInjectionResult {
            field_injected: false,
            injected_fields: vec![],
            events_dispatched: 0,
            callback_name: None,
            callback_invoked: false,
            callback_invocations: 0,
            form_submitted: false,
            submit_result: None,
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert!(!verification.soft_success);
        assert_eq!(verification.status, "injection_failed");
    }

    #[test]
    fn classify_verification_falls_back_to_pending_when_no_signal_and_no_events() {
        // 兜底分支：注入完成但 events_dispatched=0（异常情况），也没有任何成功/阻塞信号。
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
            events_dispatched: 0,
            callback_name: None,
            callback_invoked: false,
            callback_invocations: 0,
            form_submitted: false,
            submit_result: None,
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(!verification.verified);
        assert!(!verification.soft_success);
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
            callback_search: None,
        };

        let verification = CaptchaService::classify_verification(&page_state, &injection);

        assert!(verification.verified);
        assert_eq!(verification.status, "verified");
    }
}
