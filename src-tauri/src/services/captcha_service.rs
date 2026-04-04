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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptchaDetectResult {
    #[serde(rename = "type")]
    pub captcha_type: Option<String>,
    pub sitekey: Option<String>,
    pub params: Value,
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
            const result = { type: null, sitekey: null, params: {} };
            const re = document.querySelector('.g-recaptcha, [data-sitekey]');
            if (re) {
                result.type = 'recaptcha_v2';
                result.sitekey = re.getAttribute('data-sitekey');
                result.params.size = re.getAttribute('data-size');
                result.params.callback = re.getAttribute('data-callback');
                if (re.getAttribute('data-size') === 'invisible') result.type = 'recaptcha_v2_invisible';
            }
            if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
                result.type = 'recaptcha_enterprise';
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
            return JSON.stringify(result);
        })()"#
    }

    /// Token 注入 JS（根据类型生成）
    pub fn injection_js(captcha_type: &str, token: &str) -> String {
        let escaped = token.replace('\\', "\\\\").replace('\'', "\\'");
        match captcha_type {
            "recaptcha_v2" | "recaptcha_v3" | "recaptcha_enterprise" | "recaptcha" => format!(
                r#"(function() {{
                    var f = document.getElementById('g-recaptcha-response');
                    if (f) {{ f.value = '{escaped}'; f.style.display = 'block'; }}
                    if (window.___grecaptcha_cfg) {{
                        var clients = window.___grecaptcha_cfg.clients;
                        for (var id in clients) {{
                            var c = clients[id];
                            for (var k in c) {{
                                if (c[k] && typeof c[k].callback === 'function') {{
                                    c[k].callback('{escaped}'); return 'injected_callback';
                                }}
                            }}
                        }}
                    }}
                    return f ? 'injected_field' : 'no_field_found';
                }})()"#
            ),
            "hcaptcha" => format!(
                r#"(function() {{
                    var names = ['h-captcha-response', 'g-recaptcha-response'];
                    var found = false;
                    for (var i = 0; i < names.length; i++) {{
                        var el = document.querySelector('[name="' + names[i] + '"]');
                        if (el) {{ el.value = '{escaped}'; found = true; }}
                    }}
                    return found ? 'injected' : 'no_field_found';
                }})()"#
            ),
            "turnstile" => format!(
                r#"(function() {{
                    var el = document.querySelector('[name="cf-turnstile-response"]');
                    if (el) {{ el.value = '{escaped}'; return 'injected'; }}
                    return 'no_field_found';
                }})()"#
            ),
            _ => format!("'unsupported_type_{captcha_type}'"),
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
