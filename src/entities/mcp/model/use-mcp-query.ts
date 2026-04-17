import { useQuery } from '@tanstack/react-query';
import { mcpApi } from '../api/mcp-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useMcpServersQuery() {
	return useQuery({
		queryKey: queryKeys.mcpServers,
		queryFn: mcpApi.listServers,
	});
}

export function useMcpServerQuery(id: string | null) {
	return useQuery({
		queryKey: queryKeys.mcpServer(id ?? ''),
		queryFn: () => mcpApi.getServer(id!),
		enabled: !!id,
	});
}

export function useMcpToolsQuery(serverId: string | null) {
	return useQuery({
		queryKey: queryKeys.mcpTools(serverId ?? ''),
		queryFn: () => mcpApi.listTools(serverId!),
		enabled: !!serverId,
		staleTime: 30_000,
	});
}
