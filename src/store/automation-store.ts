import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
	AutomationHumanRequiredEvent,
	AutomationProgressEvent,
	AutomationVariablesUpdatedEvent,
	RunStatus,
	StepResult,
} from '@/entities/automation/model/types';

type HumanInterventionState = {
	runId: string;
	message: string;
	inputLabel: string | null;
	timeoutMs: number | null;
	stepPath: number[];
} | null;

type AutomationStoreState = {
	activeRunId: string | null;
	activeScriptId: string | null;
	stepTotal: number;
	liveStepResults: StepResult[];
	liveRunStatus: RunStatus;
	liveVariables: Record<string, string>;
	humanIntervention: HumanInterventionState;
};

type AutomationStoreActions = {
	startRun: (runId: string, scriptId: string, stepTotal: number) => void;
	onProgress: (event: AutomationProgressEvent) => void;
	onVariablesUpdated: (event: AutomationVariablesUpdatedEvent) => void;
	onHumanRequired: (event: AutomationHumanRequiredEvent) => void;
	onHumanDismissed: (runId: string) => void;
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
	humanIntervention: null,
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
			humanIntervention: null,
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
	onHumanRequired: (event) =>
		set({
			humanIntervention: {
				runId: event.runId,
				message: event.message,
				inputLabel: event.inputLabel,
				timeoutMs: event.timeoutMs,
				stepPath: event.stepPath,
			},
			liveRunStatus: 'waiting_human' as RunStatus,
		}),
	onHumanDismissed: (runId) =>
		set((state) => {
			if (state.humanIntervention?.runId !== runId) return state;
			return { humanIntervention: null };
		}),
	reset: () => set({ ...INITIAL_STATE }),
}));

export function useAutomationStore<T>(selector: (state: AutomationStore) => T) {
	return useStore(automationStore, selector);
}
