import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { ProfileNavigationIntent } from './types';

export type ConsoleNavigationStoreState = {
	profileNavigationIntent: ProfileNavigationIntent;
};

type ConsoleNavigationStoreActions = {
	reset: () => void;
	setProfileNavigationIntent: (intent: ProfileNavigationIntent) => void;
	clearProfileNavigationIntent: () => void;
};

export type ConsoleNavigationStore = ConsoleNavigationStoreState & ConsoleNavigationStoreActions;

export const CONSOLE_NAVIGATION_INITIAL_STATE: ConsoleNavigationStoreState = {
	profileNavigationIntent: null,
};

export function createConsoleNavigationStore(initialState?: Partial<ConsoleNavigationStoreState>) {
	const defaults = {
		...CONSOLE_NAVIGATION_INITIAL_STATE,
		...initialState,
	};

	return createStore<ConsoleNavigationStore>()((set) => ({
		...defaults,
		reset: () => set({ ...CONSOLE_NAVIGATION_INITIAL_STATE }),
		setProfileNavigationIntent: (intent) => set({ profileNavigationIntent: intent }),
		clearProfileNavigationIntent: () => set({ profileNavigationIntent: null }),
	}));
}

export const consoleNavigationStore = createConsoleNavigationStore();

export function useConsoleNavigationStore<T>(selector: (state: ConsoleNavigationStore) => T) {
	return useStore(consoleNavigationStore, selector);
}
