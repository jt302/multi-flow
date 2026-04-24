import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import type {
	AutomationProgressEvent,
	AutomationVariablesUpdatedEvent,
} from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';
import { automationStore } from '@/store/automation-store';

/**
 * 全局监听 automation_progress / automation_variables_updated 事件，
 * 确保用户离开自动化页面后事件不丢失。
 */
export function AutomationProgressListener() {
	const qc = useQueryClient();
	const unlistenProgressRef = useRef<(() => void) | null>(null);
	const unlistenVarsRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		listen<AutomationProgressEvent>('automation_progress', (event) => {
			if (!mounted) return;
			automationStore.getState().onProgress(event.payload);
			// 运行结束时刷新历史记录
			const status = event.payload.runStatus;
			if (status === 'success' || status === 'failed' || status === 'cancelled') {
				const run = automationStore.getState().runs[event.payload.runId];
				if (run?.scriptId) {
					qc.invalidateQueries({ queryKey: queryKeys.automationRuns(run.scriptId) });
				}
			}
		}).then((unlisten) => {
			unlistenProgressRef.current = unlisten;
		});

		listen<AutomationVariablesUpdatedEvent>('automation_variables_updated', (event) => {
			if (!mounted) return;
			automationStore.getState().onVariablesUpdated(event.payload);
		}).then((unlisten) => {
			unlistenVarsRef.current = unlisten;
		});

		return () => {
			mounted = false;
			unlistenProgressRef.current?.();
			unlistenVarsRef.current?.();
		};
	}, [qc]);

	return null;
}
