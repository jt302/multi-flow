export type ResourceItem = {
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

export type ResourceProgressState = {
	resourceId: string;
	stage: string;
	percent: number | null;
	downloadedBytes: number;
	totalBytes: number | null;
	message: string;
};
