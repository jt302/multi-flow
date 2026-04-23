import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	ApplyBookmarkTemplateRequest,
	BatchProfileActionResponse,
	BookmarkDiffResult,
	BookmarkTemplateItem,
	BookmarkTemplateSubscription,
	CreateBookmarkTemplateRequest,
	CreateProfileBookmarkRequest,
	GetProfileBookmarksResponse,
	ImportBookmarksRequest,
	MoveProfileBookmarkRequest,
	SubscribeTemplateRequest,
	UpdateBookmarkTemplateRequest,
	UpdateProfileBookmarkRequest,
} from '@/entities/bookmark/model/types';

export async function getProfileBookmarks(profileId: string): Promise<GetProfileBookmarksResponse> {
	return tauriInvoke<GetProfileBookmarksResponse>('get_profile_bookmarks', { profileId });
}

export async function createProfileBookmark(req: CreateProfileBookmarkRequest): Promise<void> {
	return tauriInvoke<void>('create_profile_bookmark', { req });
}

export async function createProfileBookmarkFolder(
	profileId: string,
	parentId: string,
	title: string,
	index?: number,
): Promise<void> {
	return tauriInvoke<void>('create_profile_bookmark_folder', { profileId, parentId, title, index });
}

export async function updateProfileBookmark(req: UpdateProfileBookmarkRequest): Promise<void> {
	return tauriInvoke<void>('update_profile_bookmark', { req });
}

export async function moveProfileBookmark(req: MoveProfileBookmarkRequest): Promise<void> {
	return tauriInvoke<void>('move_profile_bookmark', { req });
}

export async function removeProfileBookmark(profileId: string, nodeId: string): Promise<void> {
	return tauriInvoke<void>('remove_profile_bookmark', { profileId, nodeId });
}

export async function exportProfileBookmarks(profileId: string): Promise<string> {
	return tauriInvoke<string>('export_profile_bookmarks', { profileId });
}

export async function importBookmarksToProfile(req: ImportBookmarksRequest): Promise<void> {
	return tauriInvoke<void>('import_bookmarks_to_profile', { req });
}

// ─── Phase 3: 模板 API ───────────────────────────────────────────────────────

export async function listBookmarkTemplates(): Promise<BookmarkTemplateItem[]> {
	return tauriInvoke<BookmarkTemplateItem[]>('list_bookmark_templates');
}

export async function createBookmarkTemplate(
	req: CreateBookmarkTemplateRequest,
): Promise<BookmarkTemplateItem> {
	return tauriInvoke<BookmarkTemplateItem>('create_bookmark_template', { req });
}

export async function updateBookmarkTemplate(
	req: UpdateBookmarkTemplateRequest,
): Promise<BookmarkTemplateItem> {
	return tauriInvoke<BookmarkTemplateItem>('update_bookmark_template', { req });
}

export async function deleteBookmarkTemplate(id: number): Promise<void> {
	return tauriInvoke<void>('delete_bookmark_template', { id });
}

export async function applyBookmarkTemplate(
	req: ApplyBookmarkTemplateRequest,
): Promise<BatchProfileActionResponse> {
	return tauriInvoke<BatchProfileActionResponse>('apply_bookmark_template', { req });
}

// ─── Phase 4: 订阅 API ───────────────────────────────────────────────────────

export async function subscribeBookmarkTemplate(req: SubscribeTemplateRequest): Promise<void> {
	return tauriInvoke<void>('subscribe_bookmark_template', { req });
}

export async function unsubscribeBookmarkTemplate(
	templateId: number,
	profileId: string,
): Promise<void> {
	return tauriInvoke<void>('unsubscribe_bookmark_template', { templateId, profileId });
}

export async function listTemplateSubscriptions(
	templateId: number,
): Promise<BookmarkTemplateSubscription[]> {
	return tauriInvoke<BookmarkTemplateSubscription[]>('list_template_subscriptions', {
		templateId,
	});
}

export async function listProfileSubscriptions(
	profileId: string,
): Promise<BookmarkTemplateSubscription[]> {
	return tauriInvoke<BookmarkTemplateSubscription[]>('list_profile_subscriptions', { profileId });
}

// ─── Phase 5: Diff API ───────────────────────────────────────────────────────

export async function diffTemplateWithProfile(
	templateId: number,
	profileId: string,
): Promise<BookmarkDiffResult> {
	return tauriInvoke<BookmarkDiffResult>('diff_template_with_profile', { templateId, profileId });
}
