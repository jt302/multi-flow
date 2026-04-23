export type BookmarkNodeType = 'url' | 'folder';

export type BookmarkDisplayNode = {
	id: string;
	nodeId?: string;
	bookmarkId?: string;
	type: BookmarkNodeType;
	title: string;
	url?: string;
	children?: BookmarkDisplayNode[];
	parentId?: string;
	index?: number;
	managed?: boolean;
	root?: string;
};

export type BookmarkDisplayRoots = {
	bookmarkBar: BookmarkDisplayNode[];
	other: BookmarkDisplayNode[];
	mobile: BookmarkDisplayNode[];
};

export type GetProfileBookmarksResponse = {
	profileId: string;
	isLive: boolean;
	snapshotAt?: number;
	roots: BookmarkDisplayRoots;
};

export type CreateProfileBookmarkRequest = {
	profileId: string;
	parentId: string;
	title: string;
	url?: string;
	index?: number;
};

export type UpdateProfileBookmarkRequest = {
	profileId: string;
	nodeId: string;
	title?: string;
	url?: string;
};

export type MoveProfileBookmarkRequest = {
	profileId: string;
	nodeId: string;
	newParentId: string;
	index?: number;
};

export type ImportBookmarksRequest = {
	profileId: string;
	stateJson: string;
	strategy: 'mount_as_folder' | 'merge' | 'replace';
	folderTitle?: string;
};

// ─── Phase 3: 模板 ───────────────────────────────────────────────────────────

export type BookmarkTemplateItem = {
	id: number;
	name: string;
	description?: string;
	tags?: string;
	treeJson: string;
	version: number;
	createdAt: number;
	updatedAt: number;
};

export type CreateBookmarkTemplateRequest = {
	name: string;
	description?: string;
	tags?: string;
	treeJson: string;
};

export type UpdateBookmarkTemplateRequest = {
	id: number;
	name?: string;
	description?: string;
	tags?: string;
	treeJson?: string;
};

export type ApplyBookmarkTemplateRequest = {
	templateId: number;
	profileIds: string[];
	strategy: 'mount_as_folder' | 'merge' | 'replace';
	folderTitle?: string;
};

export type BatchProfileActionItem = {
	profileId: string;
	ok: boolean;
	message: string;
};

export type BatchProfileActionResponse = {
	total: number;
	successCount: number;
	failedCount: number;
	items: BatchProfileActionItem[];
};

// ─── Phase 4: 订阅 ───────────────────────────────────────────────────────────

export type BookmarkTemplateSubscription = {
	id: number;
	templateId: number;
	profileId: string;
	syncMode: 'manual' | 'auto';
	strategy: string;
	appliedVersion?: number;
	appliedAt?: number;
};

export type SubscribeTemplateRequest = {
	templateId: number;
	profileId: string;
	syncMode: 'manual' | 'auto';
	strategy: string;
};

// ─── Phase 5: Diff ───────────────────────────────────────────────────────────

export type BookmarkDiffEntry = {
	title: string;
	url?: string;
	path: string;
	nodeType: string;
};

export type BookmarkDiffResult = {
	added: BookmarkDiffEntry[];
	removed: BookmarkDiffEntry[];
	modified: BookmarkDiffEntry[];
};
