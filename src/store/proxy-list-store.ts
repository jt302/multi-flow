import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { BatchProxyActionResponse } from '@/entities/proxy/model/types';

export type ProxyFormMode = 'create' | 'edit';

export type ProxyListStoreState = {
	selectedProxyIds: string[];
	formDialogOpen: boolean;
	formMode: ProxyFormMode;
	editingProxyId: string | null;
	importDialogOpen: boolean;
	bindingDialogOpen: boolean;
	bindingProxyId: string | null;
	batchEditDialogOpen: boolean;
	batchDeleteDialogOpen: boolean;
	deleteDialogProxyId: string | null;
	lastBatchResult: BatchProxyActionResponse | null;
};

type ProxyListStoreActions = {
	reset: () => void;
	setSelectedProxyIds: (proxyIds: string[]) => void;
	toggleProxy: (proxyId: string, checked: boolean) => void;
	clearSelection: () => void;
	openCreateDialog: () => void;
	openEditDialog: (proxyId: string) => void;
	setFormDialogOpen: (open: boolean) => void;
	setImportDialogOpen: (open: boolean) => void;
	openBindingDialog: (proxyId: string) => void;
	setBindingDialogOpen: (open: boolean) => void;
	setBatchEditDialogOpen: (open: boolean) => void;
	setBatchDeleteDialogOpen: (open: boolean) => void;
	setDeleteDialogProxyId: (proxyId: string | null) => void;
	setLastBatchResult: (result: BatchProxyActionResponse | null) => void;
};

export type ProxyListStore = ProxyListStoreState & ProxyListStoreActions;

export const PROXY_LIST_INITIAL_STATE: ProxyListStoreState = {
	selectedProxyIds: [],
	formDialogOpen: false,
	formMode: 'create',
	editingProxyId: null,
	importDialogOpen: false,
	bindingDialogOpen: false,
	bindingProxyId: null,
	batchEditDialogOpen: false,
	batchDeleteDialogOpen: false,
	deleteDialogProxyId: null,
	lastBatchResult: null,
};

export function createProxyListStore(initialState?: Partial<ProxyListStoreState>) {
	const defaults = {
		...PROXY_LIST_INITIAL_STATE,
		...initialState,
	};

	return createStore<ProxyListStore>()((set) => ({
		...defaults,
		reset: () => set({ ...PROXY_LIST_INITIAL_STATE }),
		setSelectedProxyIds: (selectedProxyIds) => set({ selectedProxyIds }),
		toggleProxy: (proxyId, checked) =>
			set((state) => ({
				selectedProxyIds: checked
					? state.selectedProxyIds.includes(proxyId)
						? state.selectedProxyIds
						: [...state.selectedProxyIds, proxyId]
					: state.selectedProxyIds.filter((id) => id !== proxyId),
			})),
		clearSelection: () => set({ selectedProxyIds: [] }),
		openCreateDialog: () => set({ formDialogOpen: true, formMode: 'create', editingProxyId: null }),
		openEditDialog: (editingProxyId) =>
			set({ formDialogOpen: true, formMode: 'edit', editingProxyId }),
		setFormDialogOpen: (formDialogOpen) =>
			set({
				formDialogOpen,
				...(formDialogOpen ? {} : { formMode: 'create' as ProxyFormMode, editingProxyId: null }),
			}),
		setImportDialogOpen: (importDialogOpen) => set({ importDialogOpen }),
		openBindingDialog: (bindingProxyId) => set({ bindingDialogOpen: true, bindingProxyId }),
		setBindingDialogOpen: (bindingDialogOpen) =>
			set({
				bindingDialogOpen,
				...(bindingDialogOpen ? {} : { bindingProxyId: null }),
			}),
		setBatchEditDialogOpen: (batchEditDialogOpen) => set({ batchEditDialogOpen }),
		setBatchDeleteDialogOpen: (batchDeleteDialogOpen) => set({ batchDeleteDialogOpen }),
		setDeleteDialogProxyId: (deleteDialogProxyId) => set({ deleteDialogProxyId }),
		setLastBatchResult: (lastBatchResult) => set({ lastBatchResult }),
	}));
}

export const proxyListStore = createProxyListStore();

export function useProxyListStore<T>(selector: (state: ProxyListStore) => T) {
	return useStore(proxyListStore, selector);
}
