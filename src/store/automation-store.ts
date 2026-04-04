import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

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

type HumanInterventionState = {
	runId: string;
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
	// 扩展字段
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

type AutomationStoreState = {
	activeRunId: string | null;
	activeScriptId: string | null;
	stepTotal: number;
	liveStepResults: StepResult[];
	liveRunStatus: RunStatus;
	liveVariables: Record<string, string>;
	liveAiDetail: { stepIndex: number; detail: AiExecutionDetail } | null;
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
	liveAiDetail: null,
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
			// 用 stepPath 做精确匹配（同一个 topIndex 可能有多个嵌套结果）
			const pathKey = event.stepPath?.join('.') ?? String(event.stepIndex);
			const existing = results.findIndex(
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
			if (existing >= 0) {
				results[existing] = result;
			} else {
				results.push(result);
			}
			const liveVariables = event.varsSet
				? { ...state.liveVariables, ...event.varsSet }
				: state.liveVariables;
			// AI 实时详情：有 aiDetail 时更新，步骤完成时清除
			const liveAiDetail = event.aiDetail
				? { stepIndex: event.stepIndex, detail: event.aiDetail }
				: event.stepStatus !== 'running'
					? null
					: state.liveAiDetail;
			return { liveStepResults: results, liveRunStatus: event.runStatus, liveVariables, liveAiDetail };
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
