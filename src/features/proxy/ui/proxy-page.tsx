import { useState } from 'react';

import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { ProxyPageProps } from '@/features/proxy/model/types';
import { ProxyBindingCard } from './proxy-binding-card';
import { ProxyCreateCard } from './proxy-create-card';
import { ProxyListCard } from './proxy-list-card';
import { ProxyStats } from './proxy-stats';

export function ProxyPage({
	proxies,
	profiles,
	profileProxyBindings,
	onCreateProxy,
	onDeleteProxy,
	onRestoreProxy,
	onBindProfileProxy,
	onUnbindProfileProxy,
	onRefreshProxies,
}: ProxyPageProps) {
	const section = CONSOLE_NAV_SECTIONS.proxy;
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const activeProxies = proxies.filter((item) => item.lifecycle === 'active');
	const activeProfiles = profiles.filter((item) => item.lifecycle === 'active');
	const boundCount = activeProfiles.filter((profile) => profileProxyBindings[profile.id]).length;

	const runAction = async (fn: () => Promise<void>) => {
		if (pending) {
			return;
		}
		setPending(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : '代理操作失败');
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="代理池" title={section.title} description={section.desc} />

			<ProxyStats totalCount={proxies.length} activeCount={activeProxies.length} boundCount={boundCount} />

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
				<ProxyListCard
					proxies={proxies}
					pending={pending}
					onRefresh={() => {
						void runAction(onRefreshProxies);
					}}
					onDeleteProxy={(proxyId) => {
						void runAction(() => onDeleteProxy(proxyId));
					}}
					onRestoreProxy={(proxyId) => {
						void runAction(() => onRestoreProxy(proxyId));
					}}
				/>

				<div className="space-y-3">
					<ProxyCreateCard
						pending={pending}
						onCreateProxy={async (payload) => {
							await runAction(() => onCreateProxy(payload));
						}}
					/>

					<ProxyBindingCard
						pending={pending}
						profiles={profiles}
						activeProxies={activeProxies}
						profileProxyBindings={profileProxyBindings}
						onBindProfileProxy={async (profileId, proxyId) => {
							await runAction(() => onBindProfileProxy(profileId, proxyId));
						}}
						onUnbindProfileProxy={async (profileId) => {
							await runAction(() => onUnbindProfileProxy(profileId));
						}}
					/>
				</div>
			</div>
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}
