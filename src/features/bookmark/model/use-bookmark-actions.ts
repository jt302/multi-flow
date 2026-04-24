import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
	createProfileBookmark,
	createProfileBookmarkFolder,
	importBookmarksToProfile,
	removeProfileBookmark,
	updateProfileBookmark,
} from '@/entities/bookmark/api/bookmark-api';
import type {
	CreateProfileBookmarkRequest,
	ImportBookmarksRequest,
	UpdateProfileBookmarkRequest,
} from '@/entities/bookmark/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useBookmarkActions(profileId: string | null) {
	const queryClient = useQueryClient();
	const { t } = useTranslation('bookmark');

	const invalidate = () => {
		if (!profileId) return;
		void queryClient.invalidateQueries({
			queryKey: queryKeys.bookmarks.byProfile(profileId),
		});
	};

	const createBookmark = useMutation({
		mutationFn: (req: CreateProfileBookmarkRequest) => createProfileBookmark(req),
		onSuccess: invalidate,
		onError: () => t('errors.saveFailed'),
	});

	const createFolder = useMutation({
		mutationFn: ({
			parentId,
			title,
			index,
		}: {
			parentId: string;
			title: string;
			index?: number;
		}) => {
			if (!profileId) throw new Error(t('errors.saveFailed'));
			return createProfileBookmarkFolder(profileId, parentId, title, index);
		},
		onSuccess: invalidate,
		onError: () => t('errors.saveFailed'),
	});

	const updateBookmark = useMutation({
		mutationFn: (req: UpdateProfileBookmarkRequest) => updateProfileBookmark(req),
		onSuccess: invalidate,
		onError: () => t('errors.saveFailed'),
	});

	const removeBookmark = useMutation({
		mutationFn: (nodeId: string) => {
			if (!profileId) throw new Error(t('errors.deleteFailed'));
			return removeProfileBookmark(profileId, nodeId);
		},
		onSuccess: invalidate,
		onError: () => t('errors.deleteFailed'),
	});

	const importBookmarks = useMutation({
		mutationFn: (req: ImportBookmarksRequest) => importBookmarksToProfile(req),
		onSuccess: invalidate,
		onError: () => t('errors.importFailed'),
	});

	return { createBookmark, createFolder, updateBookmark, removeBookmark, importBookmarks };
}
