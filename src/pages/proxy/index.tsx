import { useMemo } from 'react';

import { useProfileProxyBindingsQuery } from '@/entities/profile/model/use-profile-proxy-bindings-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import { useProxyActions } from '@/features/proxy/model/use-proxy-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { ProxyPage } from '@/features/proxy/ui/proxy-page';

export function ProxyRoutePage() {
	const profilesQuery = useProfilesQuery();
	const proxiesQuery = useProxiesQuery();
	const profiles = profilesQuery.data ?? [];
	const proxies = proxiesQuery.data ?? [];
	const activeProfileIds = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'active').map((item) => item.id),
		[profiles],
	);
	const bindingsQuery = useProfileProxyBindingsQuery(activeProfileIds);
	const profileProxyBindings = bindingsQuery.data ?? {};
	const { refreshProxies, refreshProfilesAndBindings } = useWorkspaceRefresh();
	const proxyActions = useProxyActions({
		refreshProxies,
		refreshProfilesAndBindings,
	});

	return (
		<ProxyPage
			proxies={proxies.filter((item) => item.lifecycle === 'active')}
			profiles={profiles}
			profileProxyBindings={profileProxyBindings}
			onCreateProxy={proxyActions.createProxy}
			onUpdateProxy={proxyActions.updateProxy}
			onDeleteProxy={proxyActions.deleteProxy}
			onBatchDeleteProxies={proxyActions.batchDeleteProxies}
			onBatchUpdateProxies={proxyActions.batchUpdateProxies}
			onImportProxies={proxyActions.importProxies}
			onCheckProxy={proxyActions.checkProxy}
			onBatchCheckProxies={proxyActions.batchCheckProxies}
			onRestoreProxy={proxyActions.restoreProxy}
			onBindProfileProxy={proxyActions.bindProfileProxy}
			onUnbindProfileProxy={proxyActions.unbindProfileProxy}
			onRefreshProxies={async () => {
				await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			}}
		/>
	);
}
