import { create } from 'zustand';

import type { ResourceProgressState } from '@/entities/resource/model/types';

type ResourceDownloadEntry = ResourceProgressState & {
	taskId: string;
	updatedAt: number;
};

type ResourceDownloadStore = {
	// resourceId → 最新进度（同一 resourceId 同一时刻只应有一个任务）
	byResourceId: Record<string, ResourceDownloadEntry>;
	upsert: (entry: ResourceDownloadEntry) => void;
	remove: (resourceId: string) => void;
	hydrate: (entries: ResourceDownloadEntry[]) => void;
	clear: () => void;
};

export const useResourceDownloadStore = create<ResourceDownloadStore>((set) => ({
	byResourceId: {},
	upsert: (entry) =>
		set((state) => ({
			byResourceId: { ...state.byResourceId, [entry.resourceId]: entry },
		})),
	remove: (resourceId) =>
		set((state) => {
			if (!(resourceId in state.byResourceId)) return state;
			const next = { ...state.byResourceId };
			delete next[resourceId];
			return { byResourceId: next };
		}),
	hydrate: (entries) =>
		set(() => {
			const next: Record<string, ResourceDownloadEntry> = {};
			for (const entry of entries) {
				next[entry.resourceId] = entry;
			}
			return { byResourceId: next };
		}),
	clear: () => set({ byResourceId: {} }),
}));

export function useResourceDownloadProgress(
	resourceId: string | null | undefined,
): ResourceDownloadEntry | null {
	return useResourceDownloadStore((state) =>
		resourceId ? (state.byResourceId[resourceId] ?? null) : null,
	);
}
