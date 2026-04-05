use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::models::Profile;
use crate::services::profile_service::ProfileService;
use crate::services::proxy_service::ProxyService;

/// AI Chat 所需的 Profile 环境上下文（已脱敏，安全传入系统提示词）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileEnvironmentContext {
    pub profile_id: String,
    pub profile_name: String,
    pub is_active: bool,
    pub running: bool,

    // 指纹信息
    pub platform: Option<String>,
    pub browser_version: Option<String>,
    pub user_agent: Option<String>,
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub viewport: Option<String>,
    pub device_scale_factor: Option<f64>,
    pub cpu_cores: Option<i64>,
    pub ram_gb: Option<i64>,

    // 地理位置
    pub geolocation: Option<String>,

    // 代理信息（脱敏：不含 host/port/auth）
    pub proxy_protocol: Option<String>,
    pub proxy_location: Option<String>,
    pub proxy_exit_ip: Option<String>,
}

/// 从 ProfileService / ProxyService 提取多个 Profile 的环境上下文
pub fn extract_contexts(
    profile_ids: &[String],
    active_profile_id: Option<&str>,
    profile_service: &ProfileService,
    proxy_service: &ProxyService,
) -> Vec<ProfileEnvironmentContext> {
    profile_ids
        .iter()
        .filter_map(|pid| {
            let profile = profile_service.get_profile(pid).ok()?;
            let is_active = active_profile_id.map(|a| a == pid).unwrap_or(false);
            Some(build_context(&profile, is_active, proxy_service))
        })
        .collect()
}

fn build_context(
    profile: &Profile,
    is_active: bool,
    proxy_service: &ProxyService,
) -> ProfileEnvironmentContext {
    let settings = profile.settings.as_ref();
    let fp = settings
        .and_then(|s| s.fingerprint.as_ref())
        .and_then(|f| f.fingerprint_snapshot.as_ref());
    let adv = settings.and_then(|s| s.advanced.as_ref());

    let viewport = fp.and_then(|f| {
        match (f.window_width, f.window_height) {
            (Some(w), Some(h)) => Some(format!("{w}x{h}")),
            _ => None,
        }
    });

    let geolocation = adv.and_then(|a| {
        a.geolocation.as_ref().map(|g| format!("{},{}", g.latitude, g.longitude))
    });

    // 代理信息（脱敏）
    let proxy = proxy_service.get_profile_proxy(&profile.id).ok().flatten();
    let proxy_protocol = proxy.as_ref().map(|p| p.protocol.clone());
    let proxy_location = proxy.as_ref().and_then(|p| {
        let parts: Vec<&str> = [p.country.as_deref(), p.region.as_deref(), p.city.as_deref()]
            .iter()
            .filter_map(|x| *x)
            .collect();
        if parts.is_empty() { None } else { Some(parts.join(", ")) }
    });
    let proxy_exit_ip = proxy.as_ref().and_then(|p| p.exit_ip.clone());

    ProfileEnvironmentContext {
        profile_id: profile.id.clone(),
        profile_name: profile.name.clone(),
        is_active,
        running: profile.running,
        platform: fp.and_then(|f| f.platform.clone()),
        browser_version: fp.and_then(|f| f.browser_version.clone()),
        user_agent: fp.and_then(|f| f.user_agent.clone()),
        language: fp.and_then(|f| f.language.clone()),
        timezone: fp.and_then(|f| f.time_zone.clone()),
        viewport,
        device_scale_factor: fp.and_then(|f| f.device_scale_factor.map(|v| v as f64)),
        cpu_cores: fp.and_then(|f| f.custom_cpu_cores.map(|v| v as i64)),
        ram_gb: fp.and_then(|f| f.custom_ram_gb.map(|v| v as i64)),
        geolocation,
        proxy_protocol,
        proxy_location,
        proxy_exit_ip,
    }
}

/// 将环境上下文列表格式化为系统提示词片段
pub fn format_for_prompt(contexts: &[ProfileEnvironmentContext], locale: &str) -> String {
    if contexts.is_empty() {
        return String::new();
    }

    let zh = locale.starts_with("zh");
    let mut out = if zh {
        "## 当前浏览器环境\n\n- `cdp_*` / `magic_*` 总是作用于“当前工具目标环境”。\n- 当会话关联多个环境时，先调用 `app_set_chat_active_profile(profile_id)` 切换目标环境，再执行浏览器工具。\n\n".to_string()
    } else {
        "## Current Browser Environment\n\n- `cdp_*` / `magic_*` always operate on the current tool target profile.\n- When multiple profiles are attached to the chat, call `app_set_chat_active_profile(profile_id)` before using browser tools.\n\n".to_string()
    };

    for ctx in contexts {
        let active_marker = if ctx.is_active {
            if zh { " [当前工具目标环境]" } else { " [Current Tool Target]" }
        } else {
            ""
        };
        let running_label = if ctx.running {
            if zh { "运行中" } else { "Running" }
        } else {
            if zh { "未运行" } else { "Stopped" }
        };

        out.push_str(&format!("### {}{}\n", ctx.profile_name, active_marker));
        out.push_str(&format!("- {}: {}\n",
            if zh { "状态" } else { "Status" }, running_label));

        if let Some(ref p) = ctx.platform {
            out.push_str(&format!("- {}: {}\n", if zh { "平台" } else { "Platform" }, p));
        }
        if let Some(ref v) = ctx.browser_version {
            out.push_str(&format!("- {}: {}\n", if zh { "浏览器版本" } else { "Browser" }, v));
        }
        if let Some(ref ua) = ctx.user_agent {
            out.push_str(&format!("- User-Agent: {}\n", ua));
        }
        if let Some(ref lang) = ctx.language {
            out.push_str(&format!("- {}: {}\n", if zh { "语言" } else { "Language" }, lang));
        }
        if let Some(ref tz) = ctx.timezone {
            out.push_str(&format!("- {}: {}\n", if zh { "时区" } else { "Timezone" }, tz));
        }
        if let Some(ref vp) = ctx.viewport {
            out.push_str(&format!("- {}: {}\n", if zh { "视口" } else { "Viewport" }, vp));
        }
        if let Some(ref proto) = ctx.proxy_protocol {
            out.push_str(&format!("- {}: {}\n", if zh { "代理协议" } else { "Proxy" }, proto));
        }
        if let Some(ref loc) = ctx.proxy_location {
            out.push_str(&format!("- {}: {}\n", if zh { "代理位置" } else { "Proxy Location" }, loc));
        }
        if let Some(ref ip) = ctx.proxy_exit_ip {
            out.push_str(&format!("- {}: {}\n", if zh { "出口IP" } else { "Exit IP" }, ip));
        }
        if let Some(ref geo) = ctx.geolocation {
            out.push_str(&format!("- {}: {}\n", if zh { "地理位置" } else { "Geolocation" }, geo));
        }
        out.push('\n');
    }

    out
}

/// 提供 Tauri command 使用的独立函数
pub fn get_profile_environment_contexts(
    profile_ids: &[String],
    active_profile_id: Option<&str>,
    profile_service: &ProfileService,
    proxy_service: &ProxyService,
) -> AppResult<Vec<ProfileEnvironmentContext>> {
    Ok(extract_contexts(profile_ids, active_profile_id, profile_service, proxy_service))
}
