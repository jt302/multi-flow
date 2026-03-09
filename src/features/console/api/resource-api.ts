import { tauriInvoke } from './tauri-invoke';
import { listen } from '@tauri-apps/api/event';
import type { ResourceItem } from '@/entities/resource/model/types';

type BackendResourceItem = {
	id: string;
	kind: string;
	version: string;
	platform: string;
	url: string;
	fileName: string;
	installed: boolean;
	localPath: string | null;
	active: boolean;
};

type ResourceCatalogResponse = {
	source: string;
	items: BackendResourceItem[];
};

export type ResourceDownloadProgressEvent = {
	taskId: string;
	resourceId: string;
	stage: 'start' | 'download' | 'install' | 'done' | 'error' | string;
	downloadedBytes: number;
	totalBytes: number | null;
	percent: number | null;
	message: string;
};

function mapResource(item: BackendResourceItem): ResourceItem {
	return {
		id: item.id,
		kind: item.kind,
		version: item.version,
		platform: item.platform,
		url: item.url,
		fileName: item.fileName,
		installed: item.installed,
		localPath: item.localPath,
		active: item.active,
	};
}

export function createResourceTaskId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listenResourceProgress(
	taskId: string,
	resourceId: string | null,
	onProgress: (progress: ResourceDownloadProgressEvent) => void,
) {
	return listen<ResourceDownloadProgressEvent>('resource_download_progress', (event) => {
		const payload = event.payload;
		if (payload.taskId !== taskId) {
			return;
		}
		if (resourceId && payload.resourceId !== resourceId) {
			return;
		}
		onProgress(payload);
	});
}

export async function listenResourceProgressByTaskPrefix(
	taskPrefix: string,
	onProgress: (progress: ResourceDownloadProgressEvent) => void,
) {
	return listen<ResourceDownloadProgressEvent>('resource_download_progress', (event) => {
		const payload = event.payload;
		if (!payload.taskId.startsWith(taskPrefix)) {
			return;
		}
		onProgress(payload);
	});
}

export async function listResources(): Promise<ResourceItem[]> {
	const response = await tauriInvoke<ResourceCatalogResponse>('list_resources');
	return response.items.map(mapResource);
}

export async function installChromiumResource(resourceId: string): Promise<void> {
	const taskId = createResourceTaskId(`install-${resourceId}`);
	await tauriInvoke('install_chromium_resource', {
		resourceId,
		forceDownload: false,
		forceInstall: false,
		activate: true,
		taskId,
	});
}

export async function installChromiumResourceWithProgress(
	resourceId: string,
	onProgress: (progress: ResourceDownloadProgressEvent) => void,
): Promise<void> {
	const taskId = createResourceTaskId(`install-${resourceId}`);
	const unlisten = await listenResourceProgress(taskId, resourceId, onProgress);

	try {
		await tauriInvoke('install_chromium_resource', {
			resourceId,
			forceDownload: false,
			forceInstall: false,
			activate: true,
			taskId,
		});
	} finally {
		unlisten();
	}
}

export async function activateChromiumVersion(version: string): Promise<void> {
	await tauriInvoke('activate_chromium_version', {
		version,
	});
}
