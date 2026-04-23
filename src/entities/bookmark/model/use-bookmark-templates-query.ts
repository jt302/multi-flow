import { useQuery } from '@tanstack/react-query';

import {
	listBookmarkTemplates,
	listTemplateSubscriptions,
} from '@/entities/bookmark/api/bookmark-api';
import type {
	BookmarkTemplateItem,
	BookmarkTemplateSubscription,
} from '@/entities/bookmark/model/types';
import { queryKeys } from '@/shared/config/query-keys';

/** 查询所有书签模板列表 */
export function useBookmarkTemplatesQuery() {
	return useQuery<BookmarkTemplateItem[]>({
		queryKey: queryKeys.bookmarks.templates,
		queryFn: listBookmarkTemplates,
		staleTime: 10_000,
	});
}

/** 查询某个模板的所有订阅者 */
export function useTemplateSubscriptionsQuery(templateId: number | null) {
	return useQuery<BookmarkTemplateSubscription[]>({
		queryKey: queryKeys.bookmarks.subscriptionsByTemplate(templateId ?? 0),
		queryFn: () => listTemplateSubscriptions(templateId!),
		enabled: templateId !== null,
		staleTime: 10_000,
	});
}
