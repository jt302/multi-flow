import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	CreateMcpServerRequest,
	McpServer,
	McpTool,
	UpdateMcpServerRequest,
} from '../model/types';

export const mcpApi = {
	listServers: () => tauriInvoke<McpServer[]>('list_mcp_servers'),
	getServer: (id: string) => tauriInvoke<McpServer>('get_mcp_server', { id }),
	createServer: (payload: CreateMcpServerRequest) =>
		tauriInvoke<McpServer>('create_mcp_server', { payload }),
	updateServer: (id: string, payload: UpdateMcpServerRequest) =>
		tauriInvoke<McpServer>('update_mcp_server', { id, payload }),
	deleteServer: (id: string) => tauriInvoke<void>('delete_mcp_server', { id }),
	enableServer: (id: string) => tauriInvoke<McpServer>('enable_mcp_server', { id }),
	disableServer: (id: string) => tauriInvoke<McpServer>('disable_mcp_server', { id }),
	testConnection: (id: string) => tauriInvoke<string>('test_mcp_connection', { id }),
	startOAuth: (id: string) => tauriInvoke<string>('start_mcp_oauth', { id }),
	listTools: (serverId: string) =>
		tauriInvoke<McpTool[]>('list_mcp_tools', { serverId }),
	listAllTools: () => tauriInvoke<McpTool[]>('list_all_mcp_tools'),
};
