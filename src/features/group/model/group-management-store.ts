import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type GroupEditorMode = 'create' | 'edit';

export type GroupManagementStoreState = {
	searchKeyword: string;
	isFormOpen: boolean;
	editingGroupId: string | null;
	editorMode: GroupEditorMode;
};

type GroupManagementStoreActions = {
	reset: () => void;
	setSearchKeyword: (searchKeyword: string) => void;
	openCreateForm: () => void;
	openEditForm: (groupId: string) => void;
	closeForm: () => void;
};

export type GroupManagementStore = GroupManagementStoreState & GroupManagementStoreActions;

export const GROUP_MANAGEMENT_INITIAL_STATE: GroupManagementStoreState = {
	searchKeyword: '',
	isFormOpen: false,
	editingGroupId: null,
	editorMode: 'create',
};

export function createGroupManagementStore(initialState?: Partial<GroupManagementStoreState>) {
	const defaults = {
		...GROUP_MANAGEMENT_INITIAL_STATE,
		...initialState,
	};

	return createStore<GroupManagementStore>()((set) => ({
		...defaults,
		reset: () => set({ ...GROUP_MANAGEMENT_INITIAL_STATE }),
		setSearchKeyword: (searchKeyword) => set({ searchKeyword }),
		openCreateForm: () => set({ isFormOpen: true, editingGroupId: null, editorMode: 'create' }),
		openEditForm: (groupId) => set({ isFormOpen: true, editingGroupId: groupId, editorMode: 'edit' }),
		closeForm: () => set({ isFormOpen: false, editingGroupId: null, editorMode: 'create' }),
	}));
}

export const groupManagementStore = createGroupManagementStore();

export function useGroupManagementStore<T>(selector: (state: GroupManagementStore) => T) {
	return useStore(groupManagementStore, selector);
}
