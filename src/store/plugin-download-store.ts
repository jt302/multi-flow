import { create } from 'zustand';

import type { PluginDownloadProgressEvent } from '@/entities/plugin/api/plugins-api';

type PluginDownloadEntry = PluginDownloadProgressEvent & {
	updatedAt: number;
};

type PluginDownloadStore = {
	byExtensionId: Record<string, PluginDownloadEntry>;
	upsert: (entry: PluginDownloadEntry) => void;
	remove: (extensionId: string) => void;
	hydrate: (entries: PluginDownloadEntry[]) => void;
	clear: () => void;
};

export const usePluginDownloadStore = create<PluginDownloadStore>((set) => ({
	byExtensionId: {},
	upsert: (entry) =>
		set((state) => ({
			byExtensionId: {
				...state.byExtensionId,
				[entry.extensionId]: entry,
			},
		})),
	remove: (extensionId) =>
		set((state) => {
			if (!(extensionId in state.byExtensionId)) return state;
			const next = { ...state.byExtensionId };
			delete next[extensionId];
			return { byExtensionId: next };
		}),
	hydrate: (entries) =>
		set(() => {
			const next: Record<string, PluginDownloadEntry> = {};
			for (const entry of entries) {
				next[entry.extensionId] = entry;
			}
			return { byExtensionId: next };
		}),
	clear: () => set({ byExtensionId: {} }),
}));

export function usePluginDownloadProgress(
	extensionId: string | null | undefined,
): PluginDownloadEntry | null {
	return usePluginDownloadStore((state) =>
		extensionId ? (state.byExtensionId[extensionId] ?? null) : null,
	);
}
