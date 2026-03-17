import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { WindowArrangeMode } from '@/entities/window-session/model/types';

export type WindowSyncConfigTab = 'window' | 'tab' | 'text';

export type WindowSyncStoreState = {
	selectedProfileIds: string[];
	masterProfileId: string | null;
	activeConfigTab: WindowSyncConfigTab;
	arrangeMode: WindowArrangeMode;
	arrangeGap: number;
};

type WindowSyncStoreActions = {
	reset: () => void;
	toggleProfile: (profileId: string, checked: boolean) => void;
	setSelectedProfileIds: (profileIds: string[]) => void;
	setMasterProfileId: (profileId: string | null) => void;
	setActiveConfigTab: (tab: WindowSyncConfigTab) => void;
	setArrangeMode: (mode: WindowArrangeMode) => void;
	setGap: (gap: number) => void;
};

export type WindowSyncStore = WindowSyncStoreState & WindowSyncStoreActions;

export const WINDOW_SYNC_INITIAL_STATE: WindowSyncStoreState = {
	selectedProfileIds: [],
	masterProfileId: null,
	activeConfigTab: 'window',
	arrangeMode: 'grid',
	arrangeGap: 16,
};

function resolveMasterProfileId(selectedProfileIds: string[], masterProfileId: string | null) {
	if (masterProfileId && selectedProfileIds.includes(masterProfileId)) {
		return masterProfileId;
	}
	return selectedProfileIds[0] ?? null;
}

export function createWindowSyncStore(initialState?: Partial<WindowSyncStoreState>) {
	return createStore<WindowSyncStore>()((set) => ({
		...WINDOW_SYNC_INITIAL_STATE,
		...initialState,
		reset: () => set({ ...WINDOW_SYNC_INITIAL_STATE }),
		toggleProfile: (profileId, checked) =>
			set((state) => {
				const selectedProfileIds = checked
					? state.selectedProfileIds.includes(profileId)
						? state.selectedProfileIds
						: [...state.selectedProfileIds, profileId]
					: state.selectedProfileIds.filter((id) => id !== profileId);
				return {
					selectedProfileIds,
					masterProfileId: resolveMasterProfileId(
						selectedProfileIds,
						state.masterProfileId,
					),
				};
			}),
		setSelectedProfileIds: (selectedProfileIds) =>
			set((state) => ({
				selectedProfileIds,
				masterProfileId: resolveMasterProfileId(
					selectedProfileIds,
					state.masterProfileId,
				),
			})),
		setMasterProfileId: (masterProfileId) =>
			set((state) => ({
				masterProfileId:
					masterProfileId && state.selectedProfileIds.includes(masterProfileId)
						? masterProfileId
						: null,
			})),
		setActiveConfigTab: (activeConfigTab) => set({ activeConfigTab }),
		setArrangeMode: (arrangeMode) => set({ arrangeMode }),
		setGap: (arrangeGap) => set({ arrangeGap }),
	}));
}

export const windowSyncStore = createWindowSyncStore();

export function useWindowSyncStore<T>(selector: (state: WindowSyncStore) => T) {
	return useStore(windowSyncStore, selector);
}
