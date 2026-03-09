import { Suspense, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, Toaster } from '@/components/ui';
import { openLogPanelWindow } from '@/entities/log-entry/api/logs-api';
import { ConsoleSidebar } from './console-sidebar';
import { ConsolePageContent } from './console-page-content';
import { ConsoleTopbar } from './console-topbar';
import {
	isConsolePath,
	NAV_PATHS,
	resolveNavFromPath,
	resolvePathFromNav,
} from '@/features/console/routes';
import { useConsoleShellModel } from '@/widgets/console-shell/model/use-console-shell-model';
import type { NavId } from '@/widgets/console-shell/model/types';

function resolveActiveNav(pathname: string): NavId {
	return resolveNavFromPath(pathname) ?? 'dashboard';
}

export function ConsoleShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const activeNav = resolveActiveNav(location.pathname);
	const {
		consoleState,
		themeState,
		profileNavigationIntent,
		setProfileNavigationIntent,
	} = useConsoleShellModel();

	useEffect(() => {
		if (!isConsolePath(location.pathname)) {
			navigate(NAV_PATHS.dashboard, { replace: true });
		}
	}, [location.pathname, navigate]);

	const toasterTheme = themeState.resolvedMode === 'dark' ? 'dark' : 'light';
	const handleOpenLogPanel = () => {
		void (async () => {
			try {
				await openLogPanelWindow();
			} catch {
				toast.error('打开日志面板失败，已切换到内嵌页面');
				navigate('/logs');
			}
		})();
	};

	return (
		<div className="relative h-dvh overflow-hidden p-3 md:p-5">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-75"
				style={{
					background:
						'radial-gradient(circle at 8% 0%, color-mix(in oklab, var(--primary) 26%, transparent), transparent 42%), radial-gradient(circle at 92% 12%, color-mix(in oklab, var(--primary) 15%, transparent), transparent 40%)',
				}}
			/>

			<div className="relative grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-4">
				<ConsoleSidebar
					activeNav={activeNav}
					onNavChange={(nav) => navigate(resolvePathFromNav(nav))}
					isRunning={consoleState.isRunning}
					onToggleRunning={() => consoleState.setIsRunning((prev) => !prev)}
				/>

				<section className="flex h-full min-h-0 flex-col gap-3">
					<Card className="shrink-0 border-border/60 bg-card/84 p-4 backdrop-blur-2xl md:p-5">
						<ConsoleTopbar
							activeNav={activeNav}
							themeMode={themeState.themeMode}
							onThemeModeChange={themeState.setThemeMode}
							onOpenLogPanel={handleOpenLogPanel}
						/>
					</Card>
					<Card className="min-h-0 flex-1 overflow-hidden border-border/60 bg-card/84 p-4 backdrop-blur-2xl md:p-5">
						<div className="h-full min-h-0 overflow-y-auto pr-1">
							<Suspense
								fallback={
									<Card className="p-6 text-sm text-muted-foreground">
										页面加载中...
									</Card>
								}
							>
								<ConsolePageContent
									activeNav={activeNav}
									theme={{
										resolvedMode: themeState.resolvedMode,
										useCustomColor: themeState.useCustomColor,
										preset: themeState.preset,
										customColor: themeState.customColor,
										onPresetChange: (nextPreset) => {
											themeState.setUseCustomColor(false);
											themeState.setPreset(nextPreset);
										},
										onCustomColorChange: (value) => {
											themeState.setUseCustomColor(true);
											themeState.setCustomColor(value);
										},
										onToggleCustomColor: () =>
											themeState.setUseCustomColor((prev) => !prev),
									}}
									data={{
										groups: consoleState.groups,
										deletedGroups: consoleState.deletedGroups,
										profiles: consoleState.profiles,
										profileActionStates: consoleState.profileActionStates,
										proxies: consoleState.proxies,
										profileProxyBindings: consoleState.profileProxyBindings,
										resources: consoleState.resources,
										resourceProgress: consoleState.resourceProgress,
										devicePresets: consoleState.devicePresets,
										windowStates: consoleState.windowStates,
									}}
									actions={{
										createGroup: consoleState.createGroup,
										deleteGroup: consoleState.deleteGroup,
										restoreGroup: consoleState.restoreGroup,
										createProfile: consoleState.createProfile,
										updateProfile: consoleState.updateProfile,
										updateProfileVisual: consoleState.updateProfileVisual,
										openProfile: consoleState.openProfile,
										closeProfile: consoleState.closeProfile,
										batchOpenProfiles: consoleState.batchOpenProfiles,
										batchCloseProfiles: consoleState.batchCloseProfiles,
										createDevicePreset: consoleState.createDevicePreset,
										updateDevicePreset: consoleState.updateDevicePreset,
										deleteProfile: consoleState.deleteProfile,
										restoreProfile: consoleState.restoreProfile,
										refreshGroups: consoleState.refreshGroups,
										refreshProfiles: consoleState.refreshProfiles,
										createProxy: consoleState.createProxy,
										deleteProxy: consoleState.deleteProxy,
										restoreProxy: consoleState.restoreProxy,
										bindProfileProxy: consoleState.bindProfileProxy,
										unbindProfileProxy: consoleState.unbindProfileProxy,
										refreshProxies: consoleState.refreshProxies,
										refreshResources: consoleState.refreshResources,
										refreshDevicePresets: consoleState.refreshDevicePresets,
										installChromium: consoleState.installChromium,
										activateChromium: consoleState.activateChromium,
										refreshWindows: consoleState.refreshWindows,
										openTab: consoleState.openTab,
										closeTab: consoleState.closeTab,
										closeInactiveTabs: consoleState.closeInactiveTabs,
										activateTab: consoleState.activateTab,
										activateTabByIndex: consoleState.activateTabByIndex,
										openWindow: consoleState.openWindow,
										closeWindow: consoleState.closeWindow,
										focusWindow: consoleState.focusWindow,
										setWindowBounds: consoleState.setWindowBounds,
										batchOpenTabs: consoleState.batchOpenTabs,
										batchCloseTabs: consoleState.batchCloseTabs,
										batchCloseInactiveTabs: consoleState.batchCloseInactiveTabs,
										batchOpenWindows: consoleState.batchOpenWindows,
										batchFocusWindows: consoleState.batchFocusWindows,
									}}
									navigation={{
										pathname: location.pathname,
										intent: profileNavigationIntent,
										onConsumeNavigationIntent: () => setProfileNavigationIntent(null),
										onSetProfileNavigationIntent: setProfileNavigationIntent,
										onNavigate: (path) => navigate(path),
									}}
								/>
							</Suspense>
						</div>
					</Card>
				</section>
			</div>
			<Toaster theme={toasterTheme} />
		</div>
	);
}
