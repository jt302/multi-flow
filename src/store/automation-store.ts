import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type {
	AiDialogFormField,
	AiDialogTableColumn,
	AiExecutionDetail,
	AutomationHumanRequiredEvent,
	AutomationProgressEvent,
	AutomationVariablesUpdatedEvent,
	DialogButton,
	RunStatus,
	StepResult,
} from '@/entities/automation/model/types';

// ── Per-run live state ──────────────────────────────────────────────────────

export type RunState = {
	runId: string;
	scriptId: string;
	profileId?: string;
	profileName?: string;
	batchId?: string;
	stepTotal: number;
	liveStepResults: StepResult[];
	liveRunStatus: RunStatus;
	liveVariables: Record<string, string>;
	liveAiDetail: { stepIndex: number; detail: AiExecutionDetail } | null;
	endedAt?: number;
};

// ── Human intervention (single slot — Stage 3 converts to queue) ───────────

type HumanInterventionState = {
	runId: string;
	profileId?: string;
	profileName?: string;
	batchId?: string;
	message: string;
	inputLabel: string | null;
	timeoutMs: number | null;
	stepPath: number[];
	dialogType: string;
	title?: string;
	confirmText?: string;
	cancelText?: string;
	options?: string[];
	multiSelect?: boolean;
	buttons?: DialogButton[];
	fields?: AiDialogFormField[];
	submitLabel?: string;
	columns?: AiDialogTableColumn[];
	rows?: Record<string, unknown>[];
	selectable?: boolean;
	maxHeight?: number;
	image?: string;
	imageFormat?: string;
	inputPlaceholder?: string;
	seconds?: number;
	actionLabel?: string;
	autoProceed?: boolean;
	content?: string;
	width?: string;
	copyable?: boolean;
	level?: string;
} | null;

// ── Store types ─────────────────────────────────────────────────────────────

type AutomationStoreState = {
	// Multi-run registry
	runs: Record<string, RunState>;
	focusedRunId: string | null;
	batches: Record<string, string[]>; // batchId → runId[]

	// Backward-compat flat fields kept in sync with focusedRunId's RunState
	activeRunId: string | null;
	activeScriptId: string | null;
	liveRunStatus: RunStatus;
	liveStepResults: StepResult[];
	liveVariables: Record<string, string>;
	liveAiDetail: { stepIndex: number; detail: AiExecutionDetail } | null;
	humanIntervention: HumanInterventionState;
};

type AutomationStoreActions = {
	upsertRun: (
		runId: string,
		scriptId: string,
		stepTotal: number,
		profileId?: string | null,
		profileName?: string | null,
		batchId?: string | null,
	) => void;
	onProgress: (event: AutomationProgressEvent) => void;
	onVariablesUpdated: (event: AutomationVariablesUpdatedEvent) => void;
	onHumanRequired: (event: AutomationHumanRequiredEvent) => void;
	onHumanDismissed: (runId: string) => void;
	onRunCancelled: (runId: string) => void;
	setFocusedRunId: (runId: string | null) => void;
	reset: () => void;
	// Legacy alias — callers that haven't migrated yet
	startRun: (runId: string, scriptId: string, stepTotal: number) => void;
};

export type AutomationStore = AutomationStoreState & AutomationStoreActions;

// ── Helpers ─────────────────────────────────────────────────────────────────

const MAX_COMPLETED_RUNS = 20;

function pruneRuns(runs: Record<string, RunState>): Record<string, RunState> {
	const completed = Object.values(runs)
		.filter((r) => r.endedAt !== undefined)
		.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
	if (completed.length <= MAX_COMPLETED_RUNS) return runs;
	const toRemove = new Set(
		completed.slice(MAX_COMPLETED_RUNS).map((r) => r.runId),
	);
	const pruned = { ...runs };
	for (const id of toRemove) delete pruned[id];
	return pruned;
}

// Derive backward-compat flat fields from the focused RunState.
function flatFromRun(
	runs: Record<string, RunState>,
	focusedRunId: string | null,
): Pick<
	AutomationStoreState,
	| 'activeRunId'
	| 'activeScriptId'
	| 'liveRunStatus'
	| 'liveStepResults'
	| 'liveVariables'
	| 'liveAiDetail'
> {
	const r = focusedRunId ? runs[focusedRunId] : undefined;
	if (!r) {
		return {
			activeRunId: null,
			activeScriptId: null,
			liveRunStatus: 'pending',
			liveStepResults: [],
			liveVariables: {},
			liveAiDetail: null,
		};
	}
	return {
		activeRunId: r.runId,
		activeScriptId: r.scriptId,
		liveRunStatus: r.liveRunStatus,
		liveStepResults: r.liveStepResults,
		liveVariables: r.liveVariables,
		liveAiDetail: r.liveAiDetail,
	};
}

// ── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: AutomationStoreState = {
	runs: {},
	focusedRunId: null,
	batches: {},
	activeRunId: null,
	activeScriptId: null,
	liveRunStatus: 'pending',
	liveStepResults: [],
	liveVariables: {},
	liveAiDetail: null,
	humanIntervention: null,
};

// ── Store ────────────────────────────────────────────────────────────────────

export const automationStore = createStore<AutomationStore>()(
	persist(
		(set, get) => ({
			...INITIAL_STATE,

			upsertRun: (runId, scriptId, stepTotal, profileId, profileName, batchId) =>
				set((state) => {
					const newRun: RunState = {
						runId,
						scriptId,
						profileId: profileId ?? undefined,
						profileName: profileName ?? undefined,
						batchId: batchId ?? undefined,
						stepTotal,
						liveStepResults: [],
						liveRunStatus: 'running',
						liveVariables: {},
						liveAiDetail: null,
					};
					const newRuns = { ...state.runs, [runId]: newRun };
					const newBatches =
						batchId
							? {
									...state.batches,
									[batchId]: [
										...(state.batches[batchId] ?? []).filter((id) => id !== runId),
										runId,
									],
								}
							: state.batches;
					const focusedRunId = runId;
					return {
						runs: newRuns,
						focusedRunId,
						batches: newBatches,
						humanIntervention: null,
						...flatFromRun(newRuns, focusedRunId),
					};
				}),

			onProgress: (event) =>
				set((state) => {
					const existing = state.runs[event.runId];
					if (!existing) return state;

					const results = [...existing.liveStepResults];
					const pathKey = event.stepPath?.join('.') ?? String(event.stepIndex);
					const idx = results.findIndex(
						(r) => (r.stepPath?.join('.') ?? String(r.index)) === pathKey,
					);
					const result: StepResult = {
						index: event.stepIndex,
						status: event.stepStatus,
						output: event.output,
						durationMs: event.durationMs,
						varsSet: event.varsSet,
						stepPath: event.stepPath,
					};
					if (idx >= 0) results[idx] = result;
					else results.push(result);

					const liveVariables = event.varsSet
						? { ...existing.liveVariables, ...event.varsSet }
						: existing.liveVariables;
					const liveAiDetail = event.aiDetail
						? { stepIndex: event.stepIndex, detail: event.aiDetail }
						: event.stepStatus !== 'running'
							? null
							: existing.liveAiDetail;

					const isTerminal =
						event.runStatus === 'success' ||
						event.runStatus === 'failed' ||
						event.runStatus === 'cancelled';
					const updatedRun: RunState = {
						...existing,
						liveStepResults: results,
						liveRunStatus: event.runStatus,
						liveVariables,
						liveAiDetail,
						...(isTerminal && !existing.endedAt ? { endedAt: Date.now() } : {}),
					};

					const newRuns = pruneRuns({ ...state.runs, [event.runId]: updatedRun });
					return {
						runs: newRuns,
						...flatFromRun(newRuns, state.focusedRunId),
					};
				}),

			onVariablesUpdated: (event) =>
				set((state) => {
					const existing = state.runs[event.runId];
					if (!existing) return state;
					const updatedRun: RunState = {
						...existing,
						liveVariables: { ...event.vars },
					};
					const newRuns = { ...state.runs, [event.runId]: updatedRun };
					return {
						runs: newRuns,
						...flatFromRun(newRuns, state.focusedRunId),
					};
				}),

			onHumanRequired: (event) =>
				set((state) => {
					// Update the run's status in the registry
					const existing = state.runs[event.runId];
					const newRuns = existing
						? {
								...state.runs,
								[event.runId]: {
									...existing,
									liveRunStatus: 'waiting_human' as RunStatus,
								},
							}
						: state.runs;
					return {
						runs: newRuns,
						humanIntervention: {
							runId: event.runId,
							profileId: event.profileId,
							profileName: event.profileName,
							batchId: event.batchId,
							message: event.message,
							inputLabel: event.inputLabel,
							timeoutMs: event.timeoutMs,
							stepPath: event.stepPath,
							dialogType: event.dialogType ?? 'wait_for_user',
							title: event.title,
							confirmText: event.confirmText,
							cancelText: event.cancelText,
							options: event.options,
							multiSelect: event.multiSelect,
							buttons: event.buttons,
							fields: event.fields,
							submitLabel: event.submitLabel,
							columns: event.columns,
							rows: event.rows,
							selectable: event.selectable,
							maxHeight: event.maxHeight,
							image: event.image,
							imageFormat: event.imageFormat,
							inputPlaceholder: event.inputPlaceholder,
							seconds: event.seconds,
							actionLabel: event.actionLabel,
							autoProceed: event.autoProceed,
							content: event.content,
							width: event.width,
							copyable: event.copyable,
							level: event.level,
						},
						...flatFromRun(newRuns, state.focusedRunId),
					};
				}),

			onHumanDismissed: (runId) =>
				set((state) => {
					if (state.humanIntervention?.runId !== runId) return state;
					return { humanIntervention: null };
				}),

			onRunCancelled: (runId) =>
				set((state) => {
					const existing = state.runs[runId];
					if (!existing) return state;
					const updatedRun: RunState = {
						...existing,
						liveRunStatus: 'cancelled',
						endedAt: existing.endedAt ?? Date.now(),
					};
					const newRuns = pruneRuns({ ...state.runs, [runId]: updatedRun });
					return {
						runs: newRuns,
						...flatFromRun(newRuns, state.focusedRunId),
					};
				}),

			setFocusedRunId: (focusedRunId) =>
				set((state) => ({
					focusedRunId,
					...flatFromRun(state.runs, focusedRunId),
				})),

			reset: () => set({ ...INITIAL_STATE }),

			startRun: (runId, scriptId, stepTotal) =>
				get().upsertRun(runId, scriptId, stepTotal),
		}),
		{
			name: 'mf-automation-store-v2',
			partialize: (state) => ({
				activeRunId: state.activeRunId,
				activeScriptId: state.activeScriptId,
			}),
		},
	),
);

export function useAutomationStore<T>(selector: (state: AutomationStore) => T) {
	return useStore(automationStore, selector);
}

// ── Per-run selector hooks ───────────────────────────────────────────────────

export function useRunState(runId: string | null): RunState | null {
	return useAutomationStore((s) => (runId ? (s.runs[runId] ?? null) : null));
}

export function useFocusedRunState(): RunState | null {
	return useAutomationStore((s) =>
		s.focusedRunId ? (s.runs[s.focusedRunId] ?? null) : null,
	);
}

/** Returns the first active run (running/waiting_human/pending) for a script. */
export function useActiveRunForScript(scriptId: string | null): RunState | null {
	return useAutomationStore((s) => {
		if (!scriptId) return null;
		return (
			Object.values(s.runs).find(
				(r) =>
					r.scriptId === scriptId &&
					(r.liveRunStatus === 'running' ||
						r.liveRunStatus === 'waiting_human' ||
						r.liveRunStatus === 'pending'),
			) ?? null
		);
	});
}

export function useRunsByScript(scriptId: string | null): RunState[] {
	return useAutomationStore(
		useShallow((s) => {
			if (!scriptId) return [];
			return Object.values(s.runs).filter((r) => r.scriptId === scriptId);
		}),
	);
}

export function useRunsByBatch(batchId: string | null): RunState[] {
	return useAutomationStore(
		useShallow((s) => {
			if (!batchId) return [];
			return (s.batches[batchId] ?? [])
				.map((id) => s.runs[id])
				.filter(Boolean) as RunState[];
		}),
	);
}

export function useRunsByProfile(profileId: string | null): RunState[] {
	return useAutomationStore(
		useShallow((s) => {
			if (!profileId) return [];
			return Object.values(s.runs).filter((r) => r.profileId === profileId);
		}),
	);
}
