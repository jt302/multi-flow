import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
	applyBookmarkTemplate,
	createBookmarkTemplate,
	deleteBookmarkTemplate,
	updateBookmarkTemplate,
} from '@/entities/bookmark/api/bookmark-api';
import type {
	ApplyBookmarkTemplateRequest,
	BatchProfileActionResponse,
	CreateBookmarkTemplateRequest,
	UpdateBookmarkTemplateRequest,
} from '@/entities/bookmark/model/types';
import { queryKeys } from '@/shared/config/query-keys';

/** 书签模板 CRUD + 下发 mutations */
export function useTemplateActions() {
	const queryClient = useQueryClient();
	// 保存最后一次 apply 的结果，供调用方展示
	const [applyResult, setApplyResult] = useState<BatchProfileActionResponse | null>(null);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.templates });
	};

	const createTemplate = useMutation({
		mutationFn: (req: CreateBookmarkTemplateRequest) => createBookmarkTemplate(req),
		onSuccess: invalidate,
	});

	const updateTemplate = useMutation({
		mutationFn: (req: UpdateBookmarkTemplateRequest) => updateBookmarkTemplate(req),
		onSuccess: invalidate,
	});

	const deleteTemplate = useMutation({
		mutationFn: (id: number) => deleteBookmarkTemplate(id),
		onSuccess: invalidate,
	});

	const applyTemplate = useMutation({
		mutationFn: (req: ApplyBookmarkTemplateRequest) => applyBookmarkTemplate(req),
		onSuccess: (data) => {
			setApplyResult(data);
			// 下发后令相关 profile 书签缓存失效
			void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
		},
	});

	return {
		createTemplate,
		updateTemplate,
		deleteTemplate,
		applyTemplate,
		applyResult,
		clearApplyResult: () => setApplyResult(null),
	};
}
