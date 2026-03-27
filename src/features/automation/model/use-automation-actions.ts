import { useEffect, useRef } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
	createAutomationScript,
	deleteAutomationScript,
	listenAutomationProgress,
	runAutomationScript,
	updateAutomationScript,
} from '@/entities/automation/api/automation-api';
import type { CreateAutomationScriptPayload } from '@/entities/automation/model/types';
import { automationStore } from '@/store/automation-store';
import { queryKeys } from '@/shared/config/query-keys';

export function useAutomationActions(activeScriptId: string | null) {
	const queryClient = useQueryClient();
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			unlistenRef.current?.();
		};
	}, []);

	const createScript = useMutation({
		mutationFn: (payload: CreateAutomationScriptPayload) => createAutomationScript(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
	});

	const updateScript = useMutation({
		mutationFn: ({ scriptId, payload }: { scriptId: string; payload: CreateAutomationScriptPayload }) =>
			updateAutomationScript(scriptId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
	});

	const deleteScript = useMutation({
		mutationFn: (scriptId: string) => deleteAutomationScript(scriptId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.automationScripts });
		},
	});

	const runScript = useMutation({
		mutationFn: async ({ scriptId, profileId, stepTotal }: { scriptId: string; profileId: string; stepTotal: number }) => {
			const runId = await runAutomationScript(scriptId, profileId);
			automationStore.getState().startRun(runId, scriptId, stepTotal);

			unlistenRef.current?.();
			const unlisten = await listenAutomationProgress(runId, (event) => {
				automationStore.getState().onProgress(event);
				if (event.runStatus === 'success' || event.runStatus === 'failed') {
					if (activeScriptId) {
						queryClient.invalidateQueries({
							queryKey: queryKeys.automationRuns(activeScriptId),
						});
					}
				}
			});
			unlistenRef.current = unlisten;
			return runId;
		},
	});

	return { createScript, updateScript, deleteScript, runScript };
}
