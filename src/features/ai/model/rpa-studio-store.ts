import { create } from 'zustand';

type RpaStudioState = {
	selectedFlowId: string | null;
	selectedRunId: string | null;
	selectedInstanceId: string | null;
	setSelectedFlowId: (flowId: string | null) => void;
	setSelectedRunId: (runId: string | null) => void;
	setSelectedInstanceId: (instanceId: string | null) => void;
};

export const useRpaStudioStore = create<RpaStudioState>((set) => ({
	selectedFlowId: null,
	selectedRunId: null,
	selectedInstanceId: null,
	setSelectedFlowId: (selectedFlowId) => set({ selectedFlowId }),
	setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
	setSelectedInstanceId: (selectedInstanceId) => set({ selectedInstanceId }),
}));
