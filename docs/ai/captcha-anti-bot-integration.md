# 人机验证 / 反爬虫 / 风控系统 — 集成设计与实现方案

> Multi-Flow 自动化引擎的 CAPTCHA 求解与反机器人绕过功能设计文档

---

## 一、市场现状概述

### 1.1 主流人机验证系统

| 系统                 | 提供商             | 机制                      | 难度        |
| -------------------- | ------------------ | ------------------------- | ----------- |
| reCAPTCHA v2         | Google             | 复选框 + 图片挑战         | 中          |
| reCAPTCHA v3         | Google             | 纯行为评分 (0-1.0)        | 低（无 UI） |
| reCAPTCHA Enterprise | Google             | v2/v3 增强版              | 高          |
| hCaptcha             | Intuition Machines | HSW proof-of-work + 图片  | 中          |
| Cloudflare Turnstile | Cloudflare         | PoW + 指纹 + 行为启发     | 高          |
| AWS WAF Bot Control  | Amazon             | JS 挑战 + 遥测 + CAPTCHA  | 高          |
| Akamai Bot Manager   | Akamai             | 行为分析 + ML + JA4 指纹  | 极高        |
| HUMAN (PerimeterX)   | HUMAN Security     | 行为网络 + px_captcha     | 高          |
| DataDome             | DataDome           | 意图检测 + Slider CAPTCHA | 高          |
| GeeTest 极验         | 极验               | 滑块 / 点选 / 无感        | 中          |
| 网易易盾             | 网易               | 行为验证 + 风控引擎       | 中          |
| 腾讯天御             | 腾讯               | 一键验证 + 生态行为       | 中          |

### 1.2 主流求解服务

| 服务                 | 类型    | reCAPTCHA v2 价格/千次 | Turnstile 价格/千次 | 特色             |
| -------------------- | ------- | ---------------------- | ------------------- | ---------------- |
| **2Captcha**         | 人工+AI | $1-$2.99               | $1.45               | 38+ 类型，最全面 |
| **Anti-Captcha**     | 人工+AI | $0.95-$2               | $2.00               | 成熟稳定         |
| **CapSolver**        | 纯 AI   | $0.80                  | $1.20               | 速度最快         |
| **CapMonster Cloud** | 纯 AI   | $0.60                  | $1.30               | 成本最低         |

所有服务共享统一 API 模式：`createTask` → 轮询 `getTaskResult`

---

## 二、架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│  Multi-Flow 自动化引擎                                        │
│                                                              │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ 自动化脚本   │───▶│  CaptchaSolver   │───▶│ 求解服务 API │ │
│  │ (AI Agent)  │    │  统一适配层       │    │ (可切换)     │ │
│  └─────────────┘    └──────────────────┘    └─────────────┘ │
│         │                    │                      │        │
│         ▼                    ▼                      ▼        │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ CDP 页面交互 │    │ CAPTCHA 检测器    │    │ Token 注入   │ │
│  │ (截图/DOM)   │    │ (类型识别)       │    │ (CDP JS)    │ │
│  └─────────────┘    └──────────────────┘    └─────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

| 模块                | 职责                              | 位置          |
| ------------------- | --------------------------------- | ------------- |
| **CaptchaDetector** | 检测页面上的 CAPTCHA 类型和参数   | Rust service  |
| **CaptchaSolver**   | 统一求解接口，适配多家服务        | Rust service  |
| **CaptchaConfig**   | 求解服务配置管理（API Key、偏好） | Settings + DB |
| **AI Tools**        | 暴露给 AI Agent 的工具            | ai_tools      |
| **自动化步骤**      | 脚本编排中的 CAPTCHA 处理步骤     | ScriptStep    |

### 2.3 求解服务适配层

统一接口，底层切换不同服务商：

```rust
/// 求解服务统一 trait
#[async_trait]
pub trait CaptchaSolverProvider: Send + Sync {
    /// 创建求解任务
    async fn create_task(&self, task: CaptchaTask) -> Result<String, String>;
    /// 查询求解结果（轮询）
    async fn get_result(&self, task_id: &str) -> Result<CaptchaResult, String>;
    /// 查询余额
    async fn get_balance(&self) -> Result<f64, String>;
}

/// CAPTCHA 任务定义
pub struct CaptchaTask {
    pub captcha_type: CaptchaType,
    pub website_url: String,
    pub website_key: String,            // sitekey
    pub page_action: Option<String>,    // reCAPTCHA v3 action
    pub is_invisible: bool,
    pub enterprise_payload: Option<Value>,
    pub proxy: Option<ProxyConfig>,
}

/// CAPTCHA 类型枚举
pub enum CaptchaType {
    RecaptchaV2,
    RecaptchaV2Invisible,
    RecaptchaV3,
    RecaptchaEnterprise,
    HCaptcha,
    CloudflareTurnstile,
    GeeTest { gt: String, challenge: String },
    FunCaptcha { public_key: String },
    ImageToText { body: String },
    DataDome,
    AwsWaf,
    TencentCaptcha,
}

/// 求解结果
pub struct CaptchaResult {
    pub token: String,
    pub user_agent: Option<String>,     // 某些服务返回配套 UA
    pub cost: Option<f64>,
    pub solve_time_ms: u64,
}
```

---

## 三、服务商适配实现

### 3.1 2Captcha 适配器

```rust
pub struct TwoCaptchaProvider {
    api_key: String,
    base_url: String, // https://api.2captcha.com
    http: reqwest::Client,
}

impl CaptchaSolverProvider for TwoCaptchaProvider {
    async fn create_task(&self, task: CaptchaTask) -> Result<String, String> {
        let task_type = match task.captcha_type {
            CaptchaType::RecaptchaV2 => "RecaptchaV2TaskProxyless",
            CaptchaType::RecaptchaV3 => "RecaptchaV3TaskProxyless",
            CaptchaType::HCaptcha => "HCaptchaTaskProxyless",
            CaptchaType::CloudflareTurnstile => "TurnstileTaskProxyless",
            CaptchaType::GeeTest { .. } => "GeeTestTaskProxyless",
            CaptchaType::ImageToText { .. } => "ImageToTextTask",
            // ...其他类型
        };
        let body = json!({
            "clientKey": self.api_key,
            "task": {
                "type": task_type,
                "websiteURL": task.website_url,
                "websiteKey": task.website_key,
                // ...其他参数
            }
        });
        let resp = self.http.post(&format!("{}/createTask", self.base_url))
            .json(&body).send().await.map_err(|e| e.to_string())?;
        let result: Value = resp.json().await.map_err(|e| e.to_string())?;
        result["taskId"].as_i64()
            .map(|id| id.to_string())
            .ok_or_else(|| result["errorDescription"].as_str().unwrap_or("unknown error").to_string())
    }

    async fn get_result(&self, task_id: &str) -> Result<CaptchaResult, String> {
        // 轮询间隔 5 秒，最多 120 秒
        for _ in 0..24 {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let body = json!({
                "clientKey": self.api_key,
                "taskId": task_id.parse::<i64>().unwrap_or(0),
            });
            let resp = self.http.post(&format!("{}/getTaskResult", self.base_url))
                .json(&body).send().await.map_err(|e| e.to_string())?;
            let result: Value = resp.json().await.map_err(|e| e.to_string())?;
            if result["status"] == "ready" {
                return Ok(CaptchaResult {
                    token: result["solution"]["gRecaptchaResponse"]
                        .as_str()
                        .or(result["solution"]["token"].as_str())
                        .unwrap_or("").to_string(),
                    user_agent: result["solution"]["userAgent"].as_str().map(String::from),
                    cost: result["cost"].as_str().and_then(|s| s.parse().ok()),
                    solve_time_ms: /* endTime - createTime */ 0,
                });
            }
        }
        Err("求解超时".to_string())
    }
}
```

### 3.2 CapSolver 适配器

```rust
pub struct CapSolverProvider {
    api_key: String,
    base_url: String, // https://api.capsolver.com
    http: reqwest::Client,
}
// 实现模式与 2Captcha 相同，任务类型名有差异：
// RecaptchaV2 → "ReCaptchaV2TaskProxyLess"
// Turnstile → "AntiTurnstileTaskProxyLess"
```

### 3.3 Anti-Captcha 适配器

```rust
pub struct AntiCaptchaProvider { /* 同上模式 */ }
// base_url: https://api.anti-captcha.com
```

### 3.4 CapMonster Cloud 适配器

```rust
pub struct CapMonsterProvider { /* 同上模式 */ }
// base_url: https://api.capmonster.cloud
// 与 2Captcha API 完全兼容
```

---

## 四、CAPTCHA 检测器

### 4.1 自动检测实现

通过 CDP `Runtime.evaluate` 在页面中执行检测脚本：

```javascript
// CAPTCHA 类型自动检测
(function detectCaptcha() {
	const result = { type: null, sitekey: null, params: {} };

	// reCAPTCHA v2/v3
	const recaptcha = document.querySelector('.g-recaptcha, [data-sitekey]');
	if (recaptcha) {
		result.type = 'recaptcha';
		result.sitekey = recaptcha.getAttribute('data-sitekey');
		result.params.size = recaptcha.getAttribute('data-size'); // invisible?
		result.params.callback = recaptcha.getAttribute('data-callback');
	}
	if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
		result.type = 'recaptcha_enterprise';
	}

	// hCaptcha
	const hcaptcha = document.querySelector(
		'.h-captcha, [data-hcaptcha-widget-id]',
	);
	if (hcaptcha) {
		result.type = 'hcaptcha';
		result.sitekey = hcaptcha.getAttribute('data-sitekey');
	}

	// Cloudflare Turnstile
	const turnstile = document.querySelector(
		'.cf-turnstile, [data-turnstile-widget-id]',
	);
	if (turnstile) {
		result.type = 'turnstile';
		result.sitekey = turnstile.getAttribute('data-sitekey');
	}

	// GeeTest
	if (
		document.querySelector('.geetest_widget') ||
		typeof initGeetest !== 'undefined'
	) {
		result.type = 'geetest';
	}

	// FunCaptcha / Arkose Labs
	if (
		document.querySelector('#FunCaptcha') ||
		typeof ArkoseEnforcement !== 'undefined'
	) {
		result.type = 'funcaptcha';
	}

	// Cloudflare JS Challenge (非 Turnstile)
	if (
		document.title === 'Just a moment...' ||
		document.querySelector('#challenge-form')
	) {
		result.type = 'cloudflare_challenge';
	}

	return JSON.stringify(result);
})();
```

### 4.2 Token 注入实现

```javascript
// reCAPTCHA v2/v3 Token 注入
function injectRecaptchaToken(token) {
	// 方式 1: 设置隐藏字段
	const field = document.getElementById('g-recaptcha-response');
	if (field) {
		field.value = token;
		field.style.display = 'block'; // 有些站点检查 display
	}
	// 方式 2: 调用回调
	if (window.___grecaptcha_cfg) {
		const clients = window.___grecaptcha_cfg.clients;
		for (const id in clients) {
			const client = clients[id];
			// 遍历找到 callback 函数
			for (const key in client) {
				if (typeof client[key]?.callback === 'function') {
					client[key].callback(token);
					return true;
				}
			}
		}
	}
	return false;
}

// hCaptcha Token 注入
function injectHcaptchaToken(token) {
	const fields = ['h-captcha-response', 'g-recaptcha-response'];
	for (const name of fields) {
		const el = document.querySelector(`[name="${name}"]`);
		if (el) el.value = token;
	}
}

// Turnstile Token 注入
function injectTurnstileToken(token) {
	const input = document.querySelector('[name="cf-turnstile-response"]');
	if (input) input.value = token;
	// 或通过 turnstile.getResponse() 回调
}
```

---

## 五、AI Tools 集成

### 5.1 新增工具定义

```rust
// tool_defs.rs — CAPTCHA 工具类别

fn captcha_tools() -> Vec<Value> {
    vec![
        tool(
            "captcha_detect",
            "检测当前页面上的 CAPTCHA 类型和参数（sitekey 等）",
            json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        ),
        tool(
            "captcha_solve",
            "求解指定类型的 CAPTCHA 并返回 token。自动使用配置的求解服务。",
            json!({
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["recaptcha_v2", "recaptcha_v3", "hcaptcha",
                                 "turnstile", "geetest", "funcaptcha", "image"],
                        "description": "CAPTCHA 类型"
                    },
                    "sitekey": { "type": "string", "description": "站点密钥（从 captcha_detect 获取）" },
                    "page_action": { "type": "string", "description": "reCAPTCHA v3 action 参数" },
                    "image_base64": { "type": "string", "description": "图片验证码的 base64 数据" }
                },
                "required": ["type"]
            }),
        ),
        tool(
            "captcha_inject_token",
            "将求解得到的 token 注入到页面对应的表单字段中",
            json!({
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["recaptcha", "hcaptcha", "turnstile"],
                        "description": "CAPTCHA 类型"
                    },
                    "token": { "type": "string", "description": "求解服务返回的 token" }
                },
                "required": ["type", "token"]
            }),
        ),
        tool(
            "captcha_solve_and_inject",
            "一键求解并注入：自动检测页面 CAPTCHA → 求解 → 注入 token → 返回结果",
            json!({
                "type": "object",
                "properties": {
                    "auto_submit": {
                        "type": "boolean",
                        "description": "注入后是否自动提交表单（默认 false）"
                    }
                },
                "required": []
            }),
        ),
        tool(
            "captcha_get_balance",
            "查询当前求解服务的账户余额",
            json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        ),
    ]
}
```

### 5.2 自动化步骤类型

```typescript
// types.ts — 新增 ScriptStep 变体
| {
    kind: 'captcha_solve';
    /** CAPTCHA 类型（auto = 自动检测） */
    captcha_type: 'auto' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile' | 'geetest';
    /** 求解后自动注入 token */
    auto_inject: boolean;
    /** 注入后自动提交表单 */
    auto_submit: boolean;
    /** 超时毫秒数 */
    timeout_ms: number;
    /** 将 token 存入变量 */
    output_key?: string;
  }
```

---

## 六、配置管理

### 6.1 数据库 Schema

```sql
-- 求解服务配置表
CREATE TABLE captcha_solver_config (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,         -- '2captcha' | 'capsolver' | 'anticaptcha' | 'capmonster'
    api_key TEXT NOT NULL,
    base_url TEXT,                  -- 自定义端点（可选）
    is_default BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### 6.2 前端设置页面

在 Settings → AI 配置旁新增「CAPTCHA 求解」标签页：

- 服务商选择（下拉：2Captcha / CapSolver / Anti-Captcha / CapMonster）
- API Key 输入
- 测试连接（查询余额验证 key 有效性）
- 默认服务商标记
- 余额显示

---

## 七、Agent 全自动执行方案

### 7.1 AI Agent 自动处理 CAPTCHA

在 AI Agent 执行中，当遇到 CAPTCHA 时：

1. **自动检测**：AI 通过截图或 `captcha_detect` 工具识别 CAPTCHA
2. **自动求解**：调用 `captcha_solve_and_inject` 一键处理
3. **验证结果**：截图确认 CAPTCHA 已通过
4. **继续任务**：回到原始任务流程

### 7.2 系统提示词增强

```
【CAPTCHA 处理】
当你在页面上遇到验证码/人机验证时：
1. 调用 captcha_detect 检测类型
2. 调用 captcha_solve_and_inject 自动求解并注入
3. 等待 2-3 秒后截图确认是否通过
4. 如果未通过，重试一次
5. 如果仍未通过，通知用户手动处理
```

### 7.3 脚本编排中的 CAPTCHA 处理

```
[导航到目标页面]
    ↓
[captcha_solve 步骤 (type: auto)]
    ↓
[等待 2 秒]
    ↓
[继续后续操作]
```

---

## 八、实现优先级

### Phase 1 — 基础框架（预计 2-3 天）

1. `CaptchaSolverProvider` trait 和通用轮询逻辑
2. 2Captcha 适配器（覆盖最多类型）
3. CAPTCHA 检测器（JS 注入检测脚本）
4. Token 注入器（reCAPTCHA / hCaptcha / Turnstile）
5. 配置管理（DB + Settings UI）

### Phase 2 — AI 工具集成（预计 1-2 天）

1. `captcha_detect` / `captcha_solve` / `captcha_inject_token` 工具
2. `captcha_solve_and_inject` 一键工具
3. 系统提示词 CAPTCHA 处理段
4. `captcha_solve` 自动化步骤类型

### Phase 3 — 多服务商支持（预计 1-2 天）

1. CapSolver 适配器
2. Anti-Captcha 适配器
3. CapMonster Cloud 适配器
4. 前端服务商切换 UI
5. 余额查询和使用统计

### Phase 4 — 高级功能（预计 2-3 天）

1. GeeTest / FunCaptcha / 极验 / 网易易盾 支持
2. Cloudflare JS Challenge 处理
3. 代理 IP 传递（Proxy 模式任务）
4. 求解结果缓存（同一 sitekey 短期复用）
5. 使用量统计和成本追踪面板

---

## 九、2025-2026 趋势与应对

| 趋势                   | 影响               | Multi-Flow 应对                  |
| ---------------------- | ------------------ | -------------------------------- |
| 行为分析优先于图像挑战 | 自动化更难隐藏     | 依赖自研 Chromium 的真实指纹环境 |
| CDP 检测信号           | 使用 CDP 即暴露    | 自研 Chromium 可修改检测点       |
| JA4 指纹检测           | TLS 层面检测       | 指纹浏览器配置 + 代理 IP         |
| Web Unlocker 全托管化  | 独立求解 → 一体化  | 预留 Web Unlocker 接口           |
| AWS Web Bot Auth       | 合法 AI 免 CAPTCHA | 关注标准化进展，适时接入         |
| LLM 爬虫激增           | 更严格的反爬       | 结合多环境隔离 + 行为模拟        |

---

## 十、参考资源

### 求解服务 API 文档

- [2Captcha API](https://2captcha.com/api-docs)
- [CapSolver API](https://docs.capsolver.com/)
- [Anti-Captcha API](https://anti-captcha.com/apidoc)
- [CapMonster Cloud API](https://docs.capmonster.cloud/)

### 反机器人系统文档

- [reCAPTCHA Enterprise](https://cloud.google.com/recaptcha-enterprise/docs)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [GeeTest 极验文档](https://docs.geetest.com/)
- [网易易盾文档](https://support.dun.163.com/)
- [腾讯天御文档](https://www.tencentcloud.com/document/product/1159)
