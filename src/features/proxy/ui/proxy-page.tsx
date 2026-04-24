import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkspaceSection } from '@/app/model/workspace-sections';
import { DataSection } from '@/components/common';
import type { ProxyPageProps, UpdateProxyPayload } from '@/features/proxy/model/types';
import { useProxyPageState } from '@/features/proxy/model/use-proxy-page-state';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { ProxyBatchDeleteAlertDialog } from './proxy-batch-delete-alert-dialog';
import { ProxyBatchEditDialog } from './proxy-batch-edit-dialog';
import { ProxyBindingDialog } from './proxy-binding-dialog';
import { ProxyDeleteAlertDialog } from './proxy-delete-alert-dialog';
import { ProxyFormDialog } from './proxy-form-dialog';
import { ProxyImportDialog } from './proxy-import-dialog';
import { ProxyListCard } from './proxy-list-card';
import { ProxyStats } from './proxy-stats';

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
	onRestoreProxy,
	onBindProfileProxy,
	onUnbindProfileProxy,
	onRefreshProxies,
}: ProxyPageProps) {
	const { t } = useTranslation(['proxy', 'common']);
	const section = getWorkspaceSection('proxy');
	const {
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
		runNamedAction,
		handleBatchUpdate,
		handleBatchDelete,
		handleBatchCheck,
		handleSingleCheck,
		setBusyAction,
	} = useProxyPageState({
		proxies,
		profiles,
		profileProxyBindings,
		onBatchUpdateProxies,
		onBatchDeleteProxies,
		onCheckProxy,
	});
	const activeProxyIds = useMemo(() => activeProxies.map((item) => item.id), [activeProxies]);
	const setSelectedProxyIds = store.setSelectedProxyIds;
	const toggleProxy = store.toggleProxy;
	const setImportDialogOpen = store.setImportDialogOpen;
	const openCreateDialog = store.openCreateDialog;
	const openBindingDialog = store.openBindingDialog;
	const openEditDialog = store.openEditDialog;
	const setBatchEditDialogOpen = store.setBatchEditDialogOpen;
	const setBatchDeleteDialogOpen = store.setBatchDeleteDialogOpen;
	const setDeleteDialogProxyId = store.setDeleteDialogProxyId;
	const handleSelectAll = useCallback(
		(checked: boolean) => {
			setSelectedProxyIds(checked ? activeProxyIds : []);
		},
		[activeProxyIds, setSelectedProxyIds],
	);
	const handleSelectProxy = useCallback(
		(proxyId: string, checked: boolean) => {
			toggleProxy(proxyId, checked);
		},
		[toggleProxy],
	);
	const handleOpenImport = useCallback(() => {
		setImportDialogOpen(true);
	}, [setImportDialogOpen]);
	const handleOpenBatchEdit = useCallback(() => {
		setBatchEditDialogOpen(true);
	}, [setBatchEditDialogOpen]);
	const handleOpenBatchDelete = useCallback(() => {
		setBatchDeleteDialogOpen(true);
	}, [setBatchDeleteDialogOpen]);
	const handleBatchCheckClick = useCallback(() => {
		void handleBatchCheck();
	}, [handleBatchCheck]);
	const handleRefresh = useCallback(() => {
		void runNamedAction('refresh', onRefreshProxies);
	}, [onRefreshProxies, runNamedAction]);
	const handleCheckProxy = useCallback(
		(proxyId: string) => {
			void handleSingleCheck(proxyId);
		},
		[handleSingleCheck],
	);
	const handleRestoreProxy = useCallback(
		(proxyId: string) => {
			void runNamedAction('delete', () => onRestoreProxy(proxyId));
		},
		[onRestoreProxy, runNamedAction],
	);

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard label={t('proxy:pool')} title={section.title} description={section.desc} />
			<ProxyStats
				totalCount={activeProxies.length}
				activeCount={activeProxies.length}
				boundCount={boundCount}
			/>
			<DataSection
				title={t('proxy:assetList')}
				contentClassName="p-0"
				className="flex-1 min-h-0 overflow-hidden flex flex-col"
			>
				<ProxyListCard
					proxies={activeProxies}
					pending={pending}
					selectedProxyIds={selectedActiveProxyIds}
					checkingProxyIds={checkingProxyIds}
					batchChecking={batchChecking}
					refreshing={busyAction === 'refresh'}
					rowActionDisabled={busyAction !== null}
					onSelectAll={handleSelectAll}
					onSelectProxy={handleSelectProxy}
					onOpenCreate={openCreateDialog}
					onOpenImport={handleOpenImport}
					onOpenBinding={openBindingDialog}
					onOpenEdit={openEditDialog}
					onOpenBatchEdit={handleOpenBatchEdit}
					onOpenBatchDelete={handleOpenBatchDelete}
					onBatchCheck={handleBatchCheckClick}
					onRefresh={handleRefresh}
					onCheckProxy={handleCheckProxy}
					onRequestDelete={setDeleteDialogProxyId}
					onRestoreProxy={handleRestoreProxy}
					boundCounts={boundCounts}
				/>
			</DataSection>
			{store.lastBatchResult && store.lastBatchResult.failedCount > 0 ? (
				<p className="text-xs text-destructive">
					{t('common:batchResult', {
						action: t('common:batchOperation'),
						success: store.lastBatchResult.successCount,
						fail: store.lastBatchResult.failedCount,
					})}
				</p>
			) : null}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
			<ProxyFormDialog
				open={store.formDialogOpen}
				pending={pending || busyAction === 'form'}
				mode={store.formMode}
				proxy={editingProxy}
				onOpenChange={store.setFormDialogOpen}
				onCreateProxy={async (payload) => {
					await runNamedAction('form', () => onCreateProxy(payload));
				}}
				onUpdateProxy={async (proxyId, payload) => {
					await runNamedAction('form', () => onUpdateProxy(proxyId, payload));
				}}
			/>
			<ProxyImportDialog
				open={store.importDialogOpen}
				pending={pending || busyAction === 'import'}
				onOpenChange={store.setImportDialogOpen}
				onConfirm={async (payload) => {
					const result = await runNamedAction('import', () => onImportProxies(payload));
					if (result) store.setLastBatchResult(result);
				}}
			/>
			<ProxyBindingDialog
				open={store.bindingDialogOpen}
				pending={pending || busyAction === 'binding'}
				profiles={profiles}
				activeProxies={activeProxies}
				profileProxyBindings={profileProxyBindings}
				initialProxyId={store.bindingProxyId}
				onOpenChange={store.setBindingDialogOpen}
				onBindProfileProxy={async (profileId, proxyId) => {
					await runNamedAction('binding', () => onBindProfileProxy(profileId, proxyId));
				}}
				onUnbindProfileProxy={async (profileId) => {
					await runNamedAction('binding', () => onUnbindProfileProxy(profileId));
				}}
			/>
			<ProxyBatchEditDialog
				open={store.batchEditDialogOpen}
				selectedCount={selectedActiveProxyIds.length}
				pending={pending || busyAction === 'batchEdit'}
				onOpenChange={store.setBatchEditDialogOpen}
				onConfirm={async (payload: UpdateProxyPayload) => {
					setBusyAction('batchEdit');
					try {
						await handleBatchUpdate(payload);
					} finally {
						setBusyAction(null);
					}
				}}
			/>
			<ProxyBatchDeleteAlertDialog
				open={store.batchDeleteDialogOpen}
				selectedCount={selectedActiveProxyIds.length}
				pending={pending || busyAction === 'batchDelete'}
				onOpenChange={store.setBatchDeleteDialogOpen}
				onConfirm={() => {
					setBusyAction('batchDelete');
					void handleBatchDelete().finally(() => setBusyAction(null));
				}}
			/>
			<ProxyDeleteAlertDialog
				open={Boolean(store.deleteDialogProxyId && deletingProxy)}
				pending={pending || busyAction === 'delete'}
				proxyName={deletingProxy?.name ?? ''}
				onOpenChange={(open) => {
					if (!open) store.setDeleteDialogProxyId(null);
				}}
				onConfirm={() => {
					const proxyId = store.deleteDialogProxyId;
					if (!proxyId) return;
					void runNamedAction('delete', () => onDeleteProxy(proxyId)).finally(() =>
						store.setDeleteDialogProxyId(null),
					);
				}}
			/>
		</div>
	);
}
