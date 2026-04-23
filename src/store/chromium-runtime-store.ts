import { create } from 'zustand';

export type DownloadState = 'in_progress' | 'complete' | 'interrupted';

export interface DownloadItem {
	downloadId: string;
	profileId: string;
	url: string;
	filename: string;
	bytesSoFar: number;
	totalBytes: number;
	state: DownloadState;
	error?: string;
	targetPath?: string;
	updatedAt: number;
}

export interface ExtensionItem {
	id: string;
	name: string;
	profileId: string;
	enabled: boolean;
}

interface ChromiumRuntimeState {
	downloads: Record<string, DownloadItem>;
	offlineProfileIds: Set<string>;
	fullscreenWindowIds: Set<string>;
	extensions: Record<string, ExtensionItem>;

	upsertDownload(item: DownloadItem): void;
	completeDownload(profileId: string, downloadId: string, targetPath: string, total: number): void;
	interruptDownload(profileId: string, downloadId: string, error: string): void;
	clearCompleted(): void;
	setProfileOnline(profileId: string, online: boolean): void;
	setFullscreen(profileId: string, windowSessionId: string, entered: boolean): void;
	upsertExtension(item: ExtensionItem): void;
	removeExtension(profileId: string, extensionId: string): void;
	clearProfile(profileId: string): void;
}

export const useChromiumRuntimeStore = create<ChromiumRuntimeState>((set) => ({
	downloads: {},
	offlineProfileIds: new Set(),
	fullscreenWindowIds: new Set(),
	extensions: {},

	upsertDownload: (item) =>
		set((s) => ({
			downloads: {
				...s.downloads,
				[`${item.profileId}:${item.downloadId}`]: item,
			},
		})),

	completeDownload: (profileId, downloadId, targetPath, total) =>
		set((s) => {
			const key = `${profileId}:${downloadId}`;
			const existing = s.downloads[key];
			if (!existing) return s;
			return {
				downloads: {
					...s.downloads,
					[key]: {
						...existing,
						state: 'complete',
						targetPath,
						bytesSoFar: total,
						totalBytes: total,
						updatedAt: Date.now(),
					},
				},
			};
		}),

	interruptDownload: (profileId, downloadId, error) =>
		set((s) => {
			const key = `${profileId}:${downloadId}`;
			const existing = s.downloads[key];
			if (!existing) return s;
			return {
				downloads: {
					...s.downloads,
					[key]: {
						...existing,
						state: 'interrupted',
						error,
						updatedAt: Date.now(),
					},
				},
			};
		}),

	clearCompleted: () =>
		set((s) => ({
			downloads: Object.fromEntries(
				Object.entries(s.downloads).filter(([, v]) => v.state === 'in_progress'),
			),
		})),

	setProfileOnline: (profileId, online) =>
		set((s) => {
			const next = new Set(s.offlineProfileIds);
			if (online) next.delete(profileId);
			else next.add(profileId);
			return { offlineProfileIds: next };
		}),

	setFullscreen: (profileId, windowSessionId, entered) =>
		set((s) => {
			const next = new Set(s.fullscreenWindowIds);
			const key = `${profileId}:${windowSessionId}`;
			if (entered) next.add(key);
			else next.delete(key);
			return { fullscreenWindowIds: next };
		}),

	upsertExtension: (item) =>
		set((s) => ({
			extensions: {
				...s.extensions,
				[`${item.profileId}:${item.id}`]: item,
			},
		})),

	removeExtension: (profileId, extensionId) =>
		set((s) => {
			const next = { ...s.extensions };
			delete next[`${profileId}:${extensionId}`];
			return { extensions: next };
		}),

	clearProfile: (profileId) =>
		set((s) => {
			const downloads = Object.fromEntries(
				Object.entries(s.downloads).filter(([, v]) => v.profileId !== profileId),
			);
			const extensions = Object.fromEntries(
				Object.entries(s.extensions).filter(([, v]) => v.profileId !== profileId),
			);
			const offlineProfileIds = new Set(s.offlineProfileIds);
			offlineProfileIds.delete(profileId);
			const fullscreenWindowIds = new Set(
				[...s.fullscreenWindowIds].filter((k) => !k.startsWith(`${profileId}:`)),
			);
			return { downloads, extensions, offlineProfileIds, fullscreenWindowIds };
		}),
}));
