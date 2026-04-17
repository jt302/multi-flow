import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { BatchProfileActionResponse } from '@/entities/profile/model/types';
import type { ProfileListFiltersState } from '@/entities/profile/lib/profile-list';

export type QuickEditField = 'visual';

export type ProfileListQuickEditState = {
	profileId: string;
	field: QuickEditField;
} | null;

export type ProfileListStoreState = {
	error: string | null;
	filters: ProfileListFiltersState;
	quickEdit: ProfileListQuickEditState;
	batchGroupTarget: string;
	batchGroupDialogOpen: boolean;
	batchClearGroupDialogOpen: boolean;
	selectedProfileIds: string[];
	lastBatchOpenResult: BatchProfileActionResponse | null;
};

type ProfileListStoreActions = {
	reset: () => void;
	setError: (error: string | null) => void;
	patchFilters: (patch: Partial<ProfileListFiltersState>) => void;
	setQuickEdit: (quickEdit: ProfileListQuickEditState) => void;
	setBatchGroupTarget: (groupName: string) => void;
	setBatchGroupDialogOpen: (open: boolean) => void;
	setBatchClearGroupDialogOpen: (open: boolean) => void;
	toggleProfile: (profileId: string, checked: boolean) => void;
	setSelectedProfiles: (profileIds: string[]) => void;
	clearSelection: () => void;
	setBatchOpenResult: (result: BatchProfileActionResponse | null) => void;
};

export type ProfileListStore = ProfileListStoreState & ProfileListStoreActions;

export const PROFILE_LIST_INITIAL_STATE: ProfileListStoreState = {
	error: null,
	filters: {
		keyword: '',
		groupFilter: 'all',
		runningFilter: 'all',
		lifecycleFilter: 'active',
	},
	quickEdit: null,
	batchGroupTarget: '',
	batchGroupDialogOpen: false,
	batchClearGroupDialogOpen: false,
	selectedProfileIds: [],
	lastBatchOpenResult: null,
};

export function createProfileListStore(initialState?: Partial<ProfileListStoreState>) {
	const defaults = {
		...PROFILE_LIST_INITIAL_STATE,
		...initialState,
		filters: {
			...PROFILE_LIST_INITIAL_STATE.filters,
			...initialState?.filters,
		},
	};

	return createStore<ProfileListStore>()((set) => ({
		...defaults,
		reset: () => set({ ...PROFILE_LIST_INITIAL_STATE, filters: { ...PROFILE_LIST_INITIAL_STATE.filters } }),
		setError: (error) => set({ error }),
		patchFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
		setQuickEdit: (quickEdit) => set({ quickEdit }),
		setBatchGroupTarget: (batchGroupTarget) => set({ batchGroupTarget }),
		setBatchGroupDialogOpen: (batchGroupDialogOpen) => set({ batchGroupDialogOpen }),
		setBatchClearGroupDialogOpen: (batchClearGroupDialogOpen) => set({ batchClearGroupDialogOpen }),
		toggleProfile: (profileId, checked) =>
			set((state) => ({
				selectedProfileIds: checked
					? state.selectedProfileIds.includes(profileId)
						? state.selectedProfileIds
						: [...state.selectedProfileIds, profileId]
					: state.selectedProfileIds.filter((id) => id !== profileId),
			})),
		setSelectedProfiles: (profileIds) => set({ selectedProfileIds: profileIds }),
		clearSelection: () => set({ selectedProfileIds: [] }),
		setBatchOpenResult: (result) => set({ lastBatchOpenResult: result }),
	}));
}

export const profileListStore = createProfileListStore();

export function useProfileListStore<T>(selector: (state: ProfileListStore) => T) {
	return useStore(profileListStore, selector);
}
