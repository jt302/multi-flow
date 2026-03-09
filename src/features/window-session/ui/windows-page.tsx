import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { WindowsPageProps } from '@/features/window-session/model/page-types';
import { WindowBatchActionsCard } from './window-batch-actions-card';
import { WindowStatesCard } from './window-states-card';

const DEFAULT_URL = 'https://www.browserscan.net/';

const batchActionFormSchema = z.object({
	targetUrl: z
		.string()
		.trim()
		.min(1, '请输入 URL')
		.superRefine((value, ctx) => {
			try {
				const parsed = new URL(value);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'URL 必须以 http:// 或 https:// 开头',
					});
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '请输入合法 URL（必须以 http:// 或 https:// 开头）',
				});
			}
		}),
});

type BatchActionFormValues = z.infer<typeof batchActionFormSchema>;

function normalizeActionUrl(value: string) {
	const trimmed = value.trim();
	const parsed = new URL(trimmed);
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('URL 必须以 http:// 或 https:// 开头');
	}
	return parsed.toString();
}

export function WindowsPage({
	profiles,
	windowStates,
	onRefreshWindows,
	onViewProfile,
	onOpenTab,
	onCloseTab,
	onCloseInactiveTabs,
	onActivateTab,
	onActivateTabByIndex,
	onOpenWindow,
	onCloseWindow,
	onFocusWindow,
	onSetWindowBounds,
	onBatchOpenTabs,
	onBatchCloseTabs,
	onBatchCloseInactiveTabs,
	onBatchOpenWindows,
	onBatchFocusWindows,
}: WindowsPageProps) {
	const section = CONSOLE_NAV_SECTIONS.windows;
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [pendingProfileIds, setPendingProfileIds] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		trigger,
		getValues,
		formState: { errors },
	} = useForm<BatchActionFormValues>({
		resolver: zodResolver(batchActionFormSchema),
		defaultValues: {
			targetUrl: DEFAULT_URL,
		},
	});

	const runningProfileIds = useMemo(() => {
		return profiles
			.filter((item) => item.lifecycle === 'active' && item.running)
			.map((item) => item.id);
	}, [profiles]);

	const selectedRunningIds = useMemo(() => {
		const runningSet = new Set(runningProfileIds);
		return selectedProfileIds.filter((id) => runningSet.has(id));
	}, [selectedProfileIds, runningProfileIds]);

	const handleSelectProfile = (profileId: string, checked: boolean) => {
		setSelectedProfileIds((prev) => {
			if (checked) {
				if (prev.includes(profileId)) {
					return prev;
				}
				return [...prev, profileId];
			}
			return prev.filter((id) => id !== profileId);
		});
	};

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : '窗口操作失败');
		}
	};

	const resolveValidatedActionUrl = async () => {
		const valid = await trigger('targetUrl');
		if (!valid) {
			throw new Error(
				errors.targetUrl?.message ??
					'请输入合法 URL（必须以 http:// 或 https:// 开头）',
			);
		}
		return normalizeActionUrl(getValues('targetUrl'));
	};

	const runProfileAction = async (profileId: string, action: () => Promise<void>) => {
		if (pendingProfileIds.has(profileId)) {
			return;
		}
		setPendingProfileIds((prev) => new Set(prev).add(profileId));
		await runAction(action);
		setPendingProfileIds((prev) => {
			const next = new Set(prev);
			next.delete(profileId);
			return next;
		});
	};

	return (
			<div className="space-y-3">
				<ActiveSectionCard label="窗口" title={section.title} description={section.desc} />
				<WindowBatchActionsCard
					register={register}
					errors={errors}
					selectedRunningIds={selectedRunningIds}
					runningProfileIds={runningProfileIds}
					onBatchOpenTabs={() =>
						void runAction(async () => {
							const url = await resolveValidatedActionUrl();
							await onBatchOpenTabs(selectedRunningIds, url);
						})
					}
					onBatchOpenWindows={() =>
						void runAction(async () => {
							const url = await resolveValidatedActionUrl();
							await onBatchOpenWindows(selectedRunningIds, url);
						})
					}
					onBatchCloseTabs={() => void runAction(async () => onBatchCloseTabs(selectedRunningIds))}
					onBatchCloseInactiveTabs={() => void runAction(async () => onBatchCloseInactiveTabs(selectedRunningIds))}
					onBatchFocusWindows={() => void runAction(async () => onBatchFocusWindows(selectedRunningIds))}
					onRefreshWindows={() => void runAction(onRefreshWindows)}
				/>

				<WindowStatesCard
					profiles={profiles}
					windowStates={windowStates}
					selectedProfileIds={selectedProfileIds}
					pendingProfileIds={pendingProfileIds}
					error={error}
					onSelectProfile={handleSelectProfile}
					onViewProfile={onViewProfile}
					onRunProfileAction={(profileId, action) => void runProfileAction(profileId, action)}
					onResolveValidatedActionUrl={resolveValidatedActionUrl}
					onOpenTab={onOpenTab}
					onCloseTab={onCloseTab}
					onCloseInactiveTabs={onCloseInactiveTabs}
					onActivateTab={onActivateTab}
					onActivateTabByIndex={onActivateTabByIndex}
					onOpenWindow={onOpenWindow}
					onCloseWindow={onCloseWindow}
					onFocusWindow={onFocusWindow}
					onSetWindowBounds={onSetWindowBounds}
				/>
			</div>
		);
	}
