import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mcpApi } from '@/entities/mcp/api/mcp-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useCreateMcpServer() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: mcpApi.createServer,
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mcpServers }),
	});
}

export function useUpdateMcpServer() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: import('@/entities/mcp/model/types').UpdateMcpServerRequest }) =>
			mcpApi.updateServer(id, payload),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mcpServers }),
	});
}

export function useDeleteMcpServer() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: mcpApi.deleteServer,
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mcpServers }),
	});
}

export function useEnableMcpServer() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: mcpApi.enableServer,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.mcpServers });
		},
	});
}

export function useDisableMcpServer() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: mcpApi.disableServer,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.mcpServers });
		},
	});
}

export function useTestMcpConnection() {
	return useMutation({
		mutationFn: mcpApi.testConnection,
		onSuccess: (msg) => toast.success(msg),
		onError: (err: unknown) => toast.error(String(err)),
	});
}

export function useStartMcpOAuth() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: mcpApi.startOAuth,
		onSuccess: (msg) => {
			toast.success(msg);
			qc.invalidateQueries({ queryKey: queryKeys.mcpServers });
		},
		onError: (err: unknown) => toast.error(String(err)),
	});
}
