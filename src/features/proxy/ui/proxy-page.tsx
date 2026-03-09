import { useEffect, useMemo, useState } from 'react';

import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { ProxyPageProps, UpdateProxyPayload } from '@/features/proxy/model/types';
import { useProxyListStore } from '@/features/proxy/model/proxy-list-store';
import { ProxyBatchDeleteAlertDialog } from './proxy-batch-delete-alert-dialog';
import { ProxyBatchEditDialog } from './proxy-batch-edit-dialog';
import { ProxyBindingDialog } from './proxy-binding-dialog';
import { ProxyDeleteAlertDialog } from './proxy-delete-alert-dialog';
import { ProxyFormDialog } from './proxy-form-dialog';
import { ProxyImportDialog } from './proxy-import-dialog';
import { ProxyListCard } from './proxy-list-card';
import { ProxyStats } from './proxy-stats';

function areIdsEqual(left: string[], right: string[]) {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

export function ProxyPage({
	proxies,
	profiles,
	profileProxyBindings,
	onCreateProxy,
	onUpdateProxy,
	onDeleteProxy,
	onBatchDeleteProxies,
	onBatchUpdateProxies,
	onImportProxies,
	onCheckProxy,
	onBatchCheckProxies,
	onRestoreProxy,
	onBindProfileProxy,
	onUnbindProfileProxy,
	onRefreshProxies,
}: ProxyPageProps) {
	const section = CONSOLE_NAV_SECTIONS.proxy;
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const activeProxies = useMemo(() => proxies.filter((item) => item.lifecycle === 'active'), [proxies]);
	const activeProfiles = useMemo(() => profiles.filter((item) => item.lifecycle === 'active'), [profiles]);
	const boundCount = activeProfiles.filter((profile) => profileProxyBindings[profile.id]).length;
	const {
		selectedProxyIds,
		formDialogOpen,
		formMode,
		editingProxyId,
		importDialogOpen,
		bindingDialogOpen,
		bindingProxyId,
		batchEditDialogOpen,
		batchDeleteDialogOpen,
		deleteDialogProxyId,
		lastBatchResult,
		setSelectedProxyIds,
		toggleProxy,
		clearSelection,
		openCreateDialog,
		openEditDialog,
		setFormDialogOpen,
		setImportDialogOpen,
		openBindingDialog,
		setBindingDialogOpen,
		setBatchEditDialogOpen,
		setBatchDeleteDialogOpen,
		setDeleteDialogProxyId,
		setLastBatchResult,
	} = useProxyListStore((state) => state);

	useEffect(() => {
		const activeIds = new Set(activeProxies.map((item) => item.id));
		const nextSelectedProxyIds = selectedProxyIds.filter((id) => activeIds.has(id));
		if (!areIdsEqual(nextSelectedProxyIds, selectedProxyIds)) {
			setSelectedProxyIds(nextSelectedProxyIds);
		}
	}, [activeProxies, selectedProxyIds, setSelectedProxyIds]);

	const runAction = async <T,>(fn: () => Promise<T>) => {
		if (pending) return null;
		setPending(true);
		setError(null);
		try {
			return await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : '代理操作失败');
			return null;
		} finally {
			setPending(false);
		}
	};

	const selectedActiveProxyIds = useMemo(() => {
		const activeIdSet = new Set(activeProxies.map((item) => item.id));
		return selectedProxyIds.filter((id) => activeIdSet.has(id));
	}, [activeProxies, selectedProxyIds]);
	const boundCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const proxyId of Object.values(profileProxyBindings)) {
			if (!proxyId) continue;
			counts[proxyId] = (counts[proxyId] ?? 0) + 1;
		}
		return counts;
	}, [profileProxyBindings]);
	const editingProxy = useMemo(() => proxies.find((item) => item.id === editingProxyId) ?? null, [editingProxyId, proxies]);
	const deletingProxy = useMemo(
		() => proxies.find((item) => item.id === deleteDialogProxyId) ?? null,
		[deleteDialogProxyId, proxies],
	);

	const handleBatchUpdate = async (payload: UpdateProxyPayload) => {
		const result = await runAction(() => onBatchUpdateProxies(selectedActiveProxyIds, payload));
		if (result) {
			setLastBatchResult(result);
			clearSelection();
			setBatchEditDialogOpen(false);
		}
	};

	const handleBatchDelete = async () => {
		const result = await runAction(() => onBatchDeleteProxies(selectedActiveProxyIds));
		if (result) {
			setLastBatchResult(result);
			clearSelection();
			setBatchDeleteDialogOpen(false);
		}
	};

	const handleBatchCheck = async () => {
		const result = await runAction(() => onBatchCheckProxies(selectedActiveProxyIds));
		if (result) {
			setLastBatchResult(result);
		}
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="代理池" title={section.title} description={section.desc} />
			<ProxyStats totalCount={proxies.length} activeCount={activeProxies.length} boundCount={boundCount} />
			<ProxyListCard
				proxies={proxies}
				pending={pending}
				selectedProxyIds={selectedActiveProxyIds}
				onSelectAll={(checked) => setSelectedProxyIds(checked ? activeProxies.map((item) => item.id) : [])}
				onSelectProxy={(proxyId, checked) => toggleProxy(proxyId, checked)}
				onOpenCreate={openCreateDialog}
				onOpenImport={() => setImportDialogOpen(true)}
				onOpenBinding={openBindingDialog}
				onOpenEdit={openEditDialog}
				onOpenBatchEdit={() => setBatchEditDialogOpen(true)}
				onOpenBatchDelete={() => setBatchDeleteDialogOpen(true)}
				onBatchCheck={() => { void handleBatchCheck(); }}
				onRefresh={() => { void runAction(onRefreshProxies); }}
				onCheckProxy={(proxyId) => { void runAction(() => onCheckProxy(proxyId)); }}
				onRequestDelete={setDeleteDialogProxyId}
				onRestoreProxy={(proxyId) => { void runAction(() => onRestoreProxy(proxyId)); }}
				boundCounts={boundCounts}
			/>
			{lastBatchResult && lastBatchResult.failedCount > 0 ? <p className="text-xs text-destructive">批量操作存在失败项：成功 {lastBatchResult.successCount} 条，失败 {lastBatchResult.failedCount} 条。</p> : null}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
			<ProxyFormDialog
				open={formDialogOpen}
				pending={pending}
				mode={formMode}
				proxy={editingProxy}
				onOpenChange={setFormDialogOpen}
				onCreateProxy={async (payload) => { await runAction(() => onCreateProxy(payload)); }}
				onUpdateProxy={async (proxyId, payload) => { await runAction(() => onUpdateProxy(proxyId, payload)); }}
			/>
			<ProxyImportDialog
				open={importDialogOpen}
				pending={pending}
				onOpenChange={setImportDialogOpen}
				onConfirm={async (payload) => {
					const result = await runAction(() => onImportProxies(payload));
					if (result) setLastBatchResult(result);
				}}
			/>
			<ProxyBindingDialog
				open={bindingDialogOpen}
				pending={pending}
				profiles={profiles}
				activeProxies={activeProxies}
				profileProxyBindings={profileProxyBindings}
				initialProxyId={bindingProxyId}
				onOpenChange={setBindingDialogOpen}
				onBindProfileProxy={async (profileId, proxyId) => { await runAction(() => onBindProfileProxy(profileId, proxyId)); }}
				onUnbindProfileProxy={async (profileId) => { await runAction(() => onUnbindProfileProxy(profileId)); }}
			/>
			<ProxyBatchEditDialog open={batchEditDialogOpen} selectedCount={selectedActiveProxyIds.length} pending={pending} onOpenChange={setBatchEditDialogOpen} onConfirm={handleBatchUpdate} />
			<ProxyBatchDeleteAlertDialog open={batchDeleteDialogOpen} selectedCount={selectedActiveProxyIds.length} pending={pending} onOpenChange={setBatchDeleteDialogOpen} onConfirm={() => { void handleBatchDelete(); }} />
			<ProxyDeleteAlertDialog
				open={Boolean(deleteDialogProxyId && deletingProxy)}
				pending={pending}
				proxyName={deletingProxy?.name ?? ''}
				onOpenChange={(open) => {
					if (!open) setDeleteDialogProxyId(null);
				}}
				onConfirm={() => {
					if (!deleteDialogProxyId) return;
					void runAction(() => onDeleteProxy(deleteDialogProxyId)).finally(() => setDeleteDialogProxyId(null));
				}}
			/>
		</div>
	);
}
