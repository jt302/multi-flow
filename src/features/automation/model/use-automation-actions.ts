import { useEffect, useRef } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	cancelAutomationRun,
	createAutomationScript,
	deleteAutomationScript,
	listenAutomationProgress,
	listenAutomationVariablesUpdated,
	runAutomationScript,
	updateAutomationScript,
} from '@/entities/automation/api/automation-api';
import type { CreateAutomationScriptPayload } from '@/entities/automation/model/types';
import { automationStore } from '@/store/automation-store';
import { queryKeys } from '@/shared/config/query-keys';

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
			toast.error(`创建失败：${err.message}`);
		},
	});

	const updateScript = useMutation({
		mutationFn: ({ scriptId, payload }: { scriptId: string; payload: CreateAutomationScriptPayload }) =>
			updateAutomationScript(scriptId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
		onError: (err: Error) => {
			toast.error(`保存失败：${err.message}`);
		},
	});

	const deleteScript = useMutation({
		mutationFn: (scriptId: string) => deleteAutomationScript(scriptId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
		onError: (err: Error) => {
			toast.error(`删除失败：${err.message}`);
		},
	});

	const runScript = useMutation({
		mutationFn: async ({ scriptId, profileId, stepTotal }: { scriptId: string; profileId: string; stepTotal: number }) => {
			const runId = await runAutomationScript(scriptId, profileId);
			automationStore.getState().startRun(runId, scriptId, stepTotal);

			// 清理上一次监听器
			unlistenRef.current.forEach((u) => u());
			unlistenRef.current = [];

			const [unlistenProgress, unlistenVars] = await Promise.all([
				listenAutomationProgress(runId, (event) => {
					automationStore.getState().onProgress(event);
					if (event.runStatus === 'success' || event.runStatus === 'failed' || event.runStatus === 'cancelled') {
						if (activeScriptId) {
							queryClient.invalidateQueries({
								queryKey: queryKeys.automationRuns(activeScriptId),
							});
						}
					}
				}),
				listenAutomationVariablesUpdated(runId, (event) => {
					automationStore.getState().onVariablesUpdated(event);
				}),
			]);

			unlistenRef.current = [unlistenProgress, unlistenVars];
			return runId;
		},
	});

	const cancelRun = useMutation({
		mutationFn: (runId: string) => cancelAutomationRun(runId),
		onError: (err: Error) => {
			toast.error(`取消失败：${err.message}`);
		},
	});

	return { createScript, updateScript, deleteScript, runScript, cancelRun };
}
