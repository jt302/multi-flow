import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
	AutomationProgressEvent,
	AutomationVariablesUpdatedEvent,
	RunStatus,
	StepResult,
} from '@/entities/automation/model/types';

type AutomationStoreState = {
	activeRunId: string | null;
	activeScriptId: string | null;
	stepTotal: number;
	liveStepResults: StepResult[];
	liveRunStatus: RunStatus;
	liveVariables: Record<string, string>;
};

type AutomationStoreActions = {
	startRun: (runId: string, scriptId: string, stepTotal: number) => void;
	onProgress: (event: AutomationProgressEvent) => void;
	onVariablesUpdated: (event: AutomationVariablesUpdatedEvent) => void;
	reset: () => void;
};

export type AutomationStore = AutomationStoreState & AutomationStoreActions;

const INITIAL_STATE: AutomationStoreState = {
	activeRunId: null,
	activeScriptId: null,
	stepTotal: 0,
	liveStepResults: [],
	liveRunStatus: 'pending',
	liveVariables: {},
};

export const automationStore = createStore<AutomationStore>()((set) => ({
	...INITIAL_STATE,
	startRun: (activeRunId, activeScriptId, stepTotal) =>
		set({
			activeRunId,
			activeScriptId,
			stepTotal,
			liveStepResults: [],
			liveRunStatus: 'running',
			liveVariables: {},
		}),
	onProgress: (event) =>
		set((state) => {
			const results = [...state.liveStepResults];
			const existing = results.findIndex((r) => r.index === event.stepIndex);
			const result: StepResult = {
				index: event.stepIndex,
				status: event.stepStatus,
				output: event.output,
				durationMs: event.durationMs,
				varsSet: event.varsSet,
			};
			if (existing >= 0) {
				results[existing] = result;
			} else {
				results.push(result);
			}
			// 将本步骤写入的变量合并到 liveVariables
			const liveVariables = event.varsSet
				? { ...state.liveVariables, ...event.varsSet }
				: state.liveVariables;
			return { liveStepResults: results, liveRunStatus: event.runStatus, liveVariables };
		}),
	onVariablesUpdated: (event) =>
		set((state) => {
			if (state.activeRunId !== event.runId) return state;
			return { liveVariables: { ...event.vars } };
		}),
	reset: () => set({ ...INITIAL_STATE }),
}));

export function useAutomationStore<T>(selector: (state: AutomationStore) => T) {
	return useStore(automationStore, selector);
}
