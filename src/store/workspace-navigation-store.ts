import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { ProfileNavigationIntent } from '@/app/model/workspace-types';

export type WorkspaceNavigationStoreState = {
	profileNavigationIntent: ProfileNavigationIntent;
};

type WorkspaceNavigationStoreActions = {
	reset: () => void;
	setProfileNavigationIntent: (intent: ProfileNavigationIntent) => void;
	clearProfileNavigationIntent: () => void;
};

export type WorkspaceNavigationStore = WorkspaceNavigationStoreState &
	WorkspaceNavigationStoreActions;

export const WORKSPACE_NAVIGATION_INITIAL_STATE: WorkspaceNavigationStoreState = {
	profileNavigationIntent: null,
};

export function createWorkspaceNavigationStore(
	initialState?: Partial<WorkspaceNavigationStoreState>,
) {
	const defaults = {
		...WORKSPACE_NAVIGATION_INITIAL_STATE,
		...initialState,
	};

	return createStore<WorkspaceNavigationStore>()((set) => ({
		...defaults,
		reset: () => set({ ...WORKSPACE_NAVIGATION_INITIAL_STATE }),
		setProfileNavigationIntent: (intent) => set({ profileNavigationIntent: intent }),
		clearProfileNavigationIntent: () => set({ profileNavigationIntent: null }),
	}));
}

export const workspaceNavigationStore = createWorkspaceNavigationStore();

export function useWorkspaceNavigationStore<T>(selector: (state: WorkspaceNavigationStore) => T) {
	return useStore(workspaceNavigationStore, selector);
}
