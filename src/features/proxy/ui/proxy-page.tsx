import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
import { DataSection } from '@/components/common';
import type {
	ProxyPageProps,
	UpdateProxyPayload,
} from '@/features/proxy/model/types';
import { useProxyPageState } from '@/features/proxy/model/use-proxy-page-state';
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
	const section = WORKSPACE_SECTIONS.proxy;
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

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label="代理池"
				title={section.title}
				description={section.desc}
			/>
			<ProxyStats
				totalCount={activeProxies.length}
				activeCount={activeProxies.length}
				boundCount={boundCount}
			/>
			<DataSection
				title="代理资产列表"
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
					onSelectAll={(checked) =>
						store.setSelectedProxyIds(
							checked ? activeProxies.map((item) => item.id) : [],
						)
					}
					onSelectProxy={(proxyId, checked) =>
						store.toggleProxy(proxyId, checked)
					}
					onOpenCreate={store.openCreateDialog}
					onOpenImport={() => store.setImportDialogOpen(true)}
					onOpenBinding={store.openBindingDialog}
					onOpenEdit={store.openEditDialog}
					onOpenBatchEdit={() => store.setBatchEditDialogOpen(true)}
					onOpenBatchDelete={() => store.setBatchDeleteDialogOpen(true)}
					onBatchCheck={() => {
						void handleBatchCheck();
					}}
					onRefresh={() => {
						void runNamedAction('refresh', onRefreshProxies);
					}}
					onCheckProxy={(proxyId) => {
						void handleSingleCheck(proxyId);
					}}
					onRequestDelete={store.setDeleteDialogProxyId}
					onRestoreProxy={(proxyId) => {
						void runNamedAction('delete', () => onRestoreProxy(proxyId));
					}}
					boundCounts={boundCounts}
				/>
			</DataSection>
			{store.lastBatchResult && store.lastBatchResult.failedCount > 0 ? (
				<p className="text-xs text-destructive">
					批量操作存在失败项：成功 {store.lastBatchResult.successCount} 条，失败{' '}
					{store.lastBatchResult.failedCount} 条。
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
					const result = await runNamedAction('import', () =>
						onImportProxies(payload),
					);
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
					await runNamedAction('binding', () =>
						onBindProfileProxy(profileId, proxyId),
					);
				}}
				onUnbindProfileProxy={async (profileId) => {
					await runNamedAction('binding', () =>
						onUnbindProfileProxy(profileId),
					);
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
					void runNamedAction('delete', () => onDeleteProxy(proxyId)).finally(
						() => store.setDeleteDialogProxyId(null),
					);
				}}
			/>
		</div>
	);
}
