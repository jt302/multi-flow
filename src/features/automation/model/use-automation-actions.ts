import { useEffect, useRef } from 'react';

import i18n from '@/shared/i18n';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	cancelAutomationRun,
	createAutomationScript,
	deleteAutomationScript,
	listenAutomationRunCancelled,
	runAutomationScript,
	runAutomationScriptDebug,
	updateAutomationScript,
} from '@/entities/automation/api/automation-api';
import type { CreateAutomationScriptPayload } from '@/entities/automation/model/types';
import { automationStore } from '@/store/automation-store';
import { queryKeys } from '@/shared/config/query-keys';

async function registerRunListeners(
	runId: string,
	activeScriptId: string | null,
	queryClient: ReturnType<typeof useQueryClient>,
): Promise<Array<() => void>> {
	// progress / variables_updated 事件已移至全局监听 (AutomationProgressListener)
	const unlistenCancelled = await listenAutomationRunCancelled((event) => {
		if (event.runId === runId) {
			automationStore.getState().onRunCancelled(runId);
			if (activeScriptId) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.automationRuns(activeScriptId),
				});
			}
		}
	});
	return [unlistenCancelled];
}

export function useAutomationActions(activeScriptId: string | null) {
	const queryClient = useQueryClient();
	const unlistenRef = useRef<Array<() => void>>([]);

	useEffect(() => {
		return () => {
			unlistenRef.current.forEach((u) => u());
		};
	}, []);

	const createScript = useMutation({
		mutationFn: (payload: CreateAutomationScriptPayload) => createAutomationScript(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:createScriptFailed', { message: err.message }));
		},
	});

	const updateScript = useMutation({
		mutationFn: ({ scriptId, payload }: { scriptId: string; payload: CreateAutomationScriptPayload }) =>
			updateAutomationScript(scriptId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:saveScriptFailed', { message: err.message }));
		},
	});

	const deleteScript = useMutation({
		mutationFn: (scriptId: string) => deleteAutomationScript(scriptId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:deleteScriptFailed', { message: err.message }));
		},
	});

	const runScript = useMutation({
		mutationFn: async ({
			scriptId,
			profileId,
			stepTotal,
			initialVars,
			delayConfig,
			batchId,
		}: {
			scriptId: string;
			profileId: string | null;
			stepTotal: number;
			initialVars?: Record<string, string>;
			delayConfig?: { enabled: boolean; minSeconds: number; maxSeconds: number } | null;
			batchId?: string | null;
		}) => {
			const runId = await runAutomationScript(
				scriptId,
				profileId,
				initialVars,
				delayConfig,
				batchId,
			);
			automationStore.getState().upsertRun(runId, scriptId, stepTotal);

			unlistenRef.current.forEach((u) => u());
			unlistenRef.current = [];

			unlistenRef.current = await registerRunListeners(runId, activeScriptId, queryClient);
			return runId;
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:runScriptFailed', { message: err.message }));
		},
	});

	const debugRun = useMutation({
		mutationFn: async ({
			scriptId,
			profileId,
			stepTotal,
			initialVars,
		}: {
			scriptId: string;
			profileId: string | null;
			stepTotal: number;
			initialVars?: Record<string, string>;
		}) => {
			const runId = await runAutomationScriptDebug(scriptId, profileId, initialVars);
			automationStore.getState().upsertRun(runId, scriptId, stepTotal);

			unlistenRef.current.forEach((u) => u());
			unlistenRef.current = [];

			unlistenRef.current = await registerRunListeners(runId, activeScriptId, queryClient);
			return runId;
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:runScriptFailed', { message: err.message }));
		},
	});

	const cancelRun = useMutation({
		mutationFn: (runId: string) => cancelAutomationRun(runId),
		onSuccess: () => {
			toast.info(i18n.t('automation:cancellingRun'));
		},
		onError: (err: Error) => {
			toast.error(i18n.t('automation:cancelRunFailed', { message: err.message }));
		},
	});

	return { createScript, updateScript, deleteScript, runScript, debugRun, cancelRun };
}
