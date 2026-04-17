//! MCP 服务器管理命令
//! 通过 AppState::mcp_manager (Arc<McpManager>) 暴露所有 MCP 操作

use std::sync::Arc;
use tauri::{command, AppHandle, Manager};

use crate::services::mcp::manager::{
    CreateMcpServerRequest, McpServerDto, McpToolDef, UpdateMcpServerRequest,
};
use crate::services::mcp::McpManager;
use crate::state::AppState;

fn mcp(app: &AppHandle) -> Arc<McpManager> {
    app.state::<AppState>().mcp_manager.clone()
}

/// 列出所有 MCP 服务器
#[command]
pub async fn list_mcp_servers(app: AppHandle) -> Result<Vec<McpServerDto>, String> {
    mcp(&app).list_servers().await.map_err(|e| e.to_string())
}

/// 获取单个 MCP 服务器
#[command]
pub async fn get_mcp_server(app: AppHandle, id: String) -> Result<McpServerDto, String> {
    mcp(&app).get_server(&id).await.map_err(|e| e.to_string())
}

/// 创建 MCP 服务器
#[command]
pub async fn create_mcp_server(
    app: AppHandle,
    payload: CreateMcpServerRequest,
) -> Result<McpServerDto, String> {
    mcp(&app)
        .create_server(payload)
        .await
        .map_err(|e| e.to_string())
}

/// 更新 MCP 服务器配置
#[command]
pub async fn update_mcp_server(
    app: AppHandle,
    id: String,
    payload: UpdateMcpServerRequest,
) -> Result<McpServerDto, String> {
    mcp(&app)
        .update_server(&id, payload)
        .await
        .map_err(|e| e.to_string())
}

/// 删除 MCP 服务器
#[command]
pub async fn delete_mcp_server(app: AppHandle, id: String) -> Result<(), String> {
    mcp(&app).delete_server(&id).await.map_err(|e| e.to_string())
}

/// 启用 MCP 服务器
#[command]
pub async fn enable_mcp_server(app: AppHandle, id: String) -> Result<McpServerDto, String> {
    mcp(&app)
        .set_enabled(&id, true)
        .await
        .map_err(|e| e.to_string())
}

/// 禁用 MCP 服务器
#[command]
pub async fn disable_mcp_server(app: AppHandle, id: String) -> Result<McpServerDto, String> {
    mcp(&app)
        .set_enabled(&id, false)
        .await
        .map_err(|e| e.to_string())
}

/// 测试 MCP 服务器连接
#[command]
pub async fn test_mcp_connection(app: AppHandle, id: String) -> Result<String, String> {
    mcp(&app).test_connection(&id).await
}

/// 开始 OAuth 授权流程（打开系统浏览器，等待回调）
#[command]
pub async fn start_mcp_oauth(app: AppHandle, id: String) -> Result<String, String> {
    mcp(&app).start_oauth(&id).await
}

/// 列出某个服务器的工具（连接并获取）
#[command]
pub async fn list_mcp_tools(app: AppHandle, server_id: String) -> Result<Vec<McpToolDef>, String> {
    mcp(&app).list_tools(&server_id).await
}

/// 列出所有已启用服务器的工具
#[command]
pub async fn list_all_mcp_tools(app: AppHandle) -> Result<Vec<McpToolDef>, String> {
    Ok(mcp(&app).all_enabled_tools().await)
}

/// 调用 MCP 工具
#[command]
pub async fn call_mcp_tool(
    app: AppHandle,
    server_id: String,
    tool_name: String,
    args: serde_json::Value,
) -> Result<String, String> {
    mcp(&app).call_tool(&server_id, &tool_name, args).await
}
