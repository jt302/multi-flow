import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { mcpApi } from '@/entities/mcp/api/mcp-api';
import { queryKeys } from '@/shared/config/query-keys';

function normalizeErrorMessage(error: unknown) {
	const raw = error instanceof Error ? error.message : String(error);
	return raw.replace(/^Error:\s*/i, '').trim();
}

function extractToolCount(message: string) {
	const match = message.match(/Connected\.\s*(\d+)\s+tools?\s+available\.?/i);
	return match ? Number(match[1]) : null;
}

export function formatMcpConnectionMessage(
	message: string,
	t: (key: string, options?: Record<string, unknown>) => string,
) {
	const toolCount = extractToolCount(message);
	if (toolCount !== null) {
		return t('mcp.connectionTestSuccess', { count: toolCount });
	}
	if (message === 'OAuth authorization completed successfully') {
		return t('mcp.oauthSuccess');
	}
	return message;
}

export function formatMcpErrorMessage(
	error: unknown,
	t: (key: string, options?: Record<string, unknown>) => string,
) {
	const message = normalizeErrorMessage(error);
	if (message.includes('stdio transport requires a command')) {
		return t('mcp.commandRequired');
	}
	if (message.includes('OAuth config not set')) {
		return t('mcp.oauthConfigRequired');
	}
	if (message.includes('Invalid oauth_config_json')) {
		return t('mcp.oauthConfigInvalid');
	}
	if (message.includes('Invalid args_json')) {
		return t('mcp.argsJsonInvalid');
	}
	if (message.includes('Invalid env_json')) {
		return t('mcp.envJsonInvalid');
	}
	if (message.includes('Invalid headers_json')) {
		return t('mcp.headersJsonInvalid');
	}
	return message;
}

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
	const { t } = useTranslation('chat');
	return useMutation({
		mutationFn: mcpApi.testConnection,
		onSuccess: (msg) => toast.success(formatMcpConnectionMessage(msg, t)),
		onError: (err: unknown) => toast.error(formatMcpErrorMessage(err, t)),
	});
}

export function useTestMcpDraftConnection() {
	const { t } = useTranslation('chat');
	return useMutation({
		mutationFn: mcpApi.testConnectionDraft,
		onSuccess: (msg) => toast.success(formatMcpConnectionMessage(msg, t)),
		onError: (err: unknown) => toast.error(formatMcpErrorMessage(err, t)),
	});
}

export function useStartMcpOAuth() {
	const qc = useQueryClient();
	const { t } = useTranslation('chat');
	return useMutation({
		mutationFn: mcpApi.startOAuth,
		onSuccess: (msg) => {
			toast.success(formatMcpConnectionMessage(msg, t));
			qc.invalidateQueries({ queryKey: queryKeys.mcpServers });
		},
		onError: (err: unknown) => toast.error(formatMcpErrorMessage(err, t)),
	});
}

export function useDiscoverMcpOAuth() {
	const { t } = useTranslation('chat');
	return useMutation({
		mutationFn: (baseUrl: string) => mcpApi.discoverOAuth(baseUrl),
		onError: (err: unknown) => toast.error(formatMcpErrorMessage(err, t)),
	});
}
