import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { ProfileItem, ProfileProxyBindingMap } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { useProxyListStore } from '@/store/proxy-list-store';
import type { BatchProxyActionResponse, UpdateProxyPayload } from './types';

function areIdsEqual(left: string[], right: string[]) {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

type UseProxyPageStateOptions = {
	proxies: ProxyItem[];
	profiles: ProfileItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	onBatchUpdateProxies: (
		proxyIds: string[],
		payload: UpdateProxyPayload,
	) => Promise<BatchProxyActionResponse>;
	onBatchDeleteProxies: (proxyIds: string[]) => Promise<BatchProxyActionResponse>;
	onCheckProxy: (proxyId: string, options?: { silent?: boolean }) => Promise<void>;
};

export function useProxyPageState({
	proxies,
	profiles,
	profileProxyBindings,
	onBatchUpdateProxies,
	onBatchDeleteProxies,
	onCheckProxy,
}: UseProxyPageStateOptions) {
	const { t } = useTranslation(['proxy', 'common']);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busyAction, setBusyAction] = useState<
		'form' | 'import' | 'binding' | 'batchEdit' | 'batchDelete' | 'delete' | 'refresh' | null
	>(null);
	const [checkingProxyIds, setCheckingProxyIds] = useState<string[]>([]);
	const [batchChecking, setBatchChecking] = useState(false);
	const activeProxies = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'active'),
		[proxies],
	);
	const activeProfiles = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'active'),
		[profiles],
	);
	const boundCount = activeProfiles.filter((profile) => profileProxyBindings[profile.id]).length;
	const store = useProxyListStore((state) => state);

	useEffect(() => {
		const activeIds = new Set(activeProxies.map((item) => item.id));
		const nextSelectedProxyIds = store.selectedProxyIds.filter((id) => activeIds.has(id));
		if (!areIdsEqual(nextSelectedProxyIds, store.selectedProxyIds)) {
			store.setSelectedProxyIds(nextSelectedProxyIds);
		}
	}, [activeProxies, store]);

	const runAction = async <T>(fn: () => Promise<T>) => {
		if (pending) return null;
		setPending(true);
		setError(null);
		try {
			return await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('proxy:actions.operationFailed'));
			return null;
		} finally {
			setPending(false);
		}
	};

	const runNamedAction = async <T>(
		action: NonNullable<typeof busyAction>,
		fn: () => Promise<T>,
	) => {
		if (pending || batchChecking) return null;
		setBusyAction(action);
		try {
			return await runAction(fn);
		} finally {
			setBusyAction(null);
		}
	};

	const selectedActiveProxyIds = useMemo(() => {
		const activeIdSet = new Set(activeProxies.map((item) => item.id));
		return store.selectedProxyIds.filter((id) => activeIdSet.has(id));
	}, [activeProxies, store.selectedProxyIds]);
	const boundCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const proxyId of Object.values(profileProxyBindings)) {
			if (!proxyId) continue;
			counts[proxyId] = (counts[proxyId] ?? 0) + 1;
		}
		return counts;
	}, [profileProxyBindings]);
	const editingProxy = useMemo(
		() => proxies.find((item) => item.id === store.editingProxyId) ?? null,
		[proxies, store.editingProxyId],
	);
	const deletingProxy = useMemo(
		() => proxies.find((item) => item.id === store.deleteDialogProxyId) ?? null,
		[proxies, store.deleteDialogProxyId],
	);

	const handleBatchUpdate = async (payload: UpdateProxyPayload) => {
		const result = await runAction(() => onBatchUpdateProxies(selectedActiveProxyIds, payload));
		if (result) {
			store.setLastBatchResult(result);
			store.clearSelection();
			store.setBatchEditDialogOpen(false);
		}
	};

	const handleBatchDelete = async () => {
		const result = await runAction(() => onBatchDeleteProxies(selectedActiveProxyIds));
		if (result) {
			store.setLastBatchResult(result);
			store.clearSelection();
			store.setBatchDeleteDialogOpen(false);
		}
	};

	const handleBatchCheck = async () => {
		if (pending || batchChecking || selectedActiveProxyIds.length === 0) {
			return;
		}
		setBatchChecking(true);
		setError(null);
		store.setLastBatchResult(null);
		const queue = [...selectedActiveProxyIds];
		const processing = new Set<string>();
		const items: Array<{ proxyId: string; ok: boolean; message: string }> = [];
		let successCount = 0;

		const syncChecking = () => setCheckingProxyIds(Array.from(processing));
		const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
			while (queue.length > 0) {
				const proxyId = queue.shift();
				if (!proxyId) return;
				processing.add(proxyId);
				syncChecking();
				try {
					await onCheckProxy(proxyId, { silent: true });
					successCount += 1;
					items.push({ proxyId, ok: true, message: 'checked' });
				} catch (err) {
					items.push({
						proxyId,
						ok: false,
						message: err instanceof Error ? err.message : t('proxy:actions.checkFailed'),
					});
				} finally {
					processing.delete(proxyId);
					syncChecking();
				}
			}
		});

		try {
			await Promise.all(workers);
			const result = {
				total: selectedActiveProxyIds.length,
				successCount,
				failedCount: selectedActiveProxyIds.length - successCount,
				items,
			};
			store.setLastBatchResult(result);
			if (result.failedCount > 0) {
				toast.warning(
					t('common:batchResult', {
						action: t('proxy:actions.batchCheck'),
						success: result.successCount,
						fail: result.failedCount,
					}),
				);
			} else {
				toast.success(
					t('common:batchResult', {
						action: t('proxy:actions.batchCheck'),
						success: result.successCount,
						fail: 0,
					}),
				);
			}
		} finally {
			setBatchChecking(false);
		}
	};

	const handleSingleCheck = async (proxyId: string) => {
		if (pending || batchChecking || checkingProxyIds.includes(proxyId)) {
			return;
		}
		setCheckingProxyIds((prev) => [...prev, proxyId]);
		setError(null);
		try {
			await onCheckProxy(proxyId);
		} catch (err) {
			setError(err instanceof Error ? err.message : t('proxy:actions.checkFailed'));
		} finally {
			setCheckingProxyIds((prev) => prev.filter((id) => id !== proxyId));
		}
	};

	return {
		store,
		pending,
		error,
		busyAction,
		checkingProxyIds,
		batchChecking,
		activeProxies,
		boundCount,
		selectedActiveProxyIds,
		boundCounts,
		editingProxy,
		deletingProxy,
		runAction,
		runNamedAction,
		handleBatchUpdate,
		handleBatchDelete,
		handleBatchCheck,
		handleSingleCheck,
		setBusyAction,
	};
}
