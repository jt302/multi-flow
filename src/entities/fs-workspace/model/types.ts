export type FsRoot = {
	id: string;
	label: string;
	pathDisplay: string;
	allowWrite: boolean;
	isDefault: boolean;
};

export type FsEntry = {
	name: string;
	relPath: string;
	isDir: boolean;
	size: number | null;
	modifiedAt: number | null;
	hasDescription: boolean;
};

export type FsWhitelistEntry = {
	id: string;
	label: string;
	path: string;
	allowWrite: boolean;
};
