import { lazy, Suspense, useEffect } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, Toaster } from '@/components/ui';
import { openLogPanelWindow } from '@/features/logs';
import { useThemeSettings } from '@/features/console/hooks';
import { ConsoleSidebar, ConsoleTopbar } from '@/features/console/components';
import { useConsoleState } from '@/features/console/hooks';
import {
	isConsolePath,
	NAV_PATHS,
	SETTINGS_RECYCLE_BIN_PATH,
	resolveNavFromPath,
	resolvePathFromNav,
} from '@/features/console/routes';
import type { NavId } from '@/features/console/types';

const DashboardPage = lazy(() =>
	import('@/features/console/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const ProfilesPage = lazy(() =>
	import('@/features/console/pages/profiles-page').then((module) => ({ default: module.ProfilesPage })),
);
const GroupsPage = lazy(() =>
	import('@/features/console/pages/groups-page').then((module) => ({ default: module.GroupsPage })),
);
const ProxyPage = lazy(() =>
	import('@/features/console/pages/proxy-page').then((module) => ({ default: module.ProxyPage })),
);
const WindowsPage = lazy(() =>
	import('@/features/console/pages/windows-page').then((module) => ({ default: module.WindowsPage })),
);
const AiPage = lazy(() =>
	import('@/features/console/pages/ai-page').then((module) => ({ default: module.AiPage })),
);
const SettingsPage = lazy(() =>
	import('@/features/console/pages/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const RecycleBinPage = lazy(() =>
	import('@/features/console/pages/recycle-bin-page').then((module) => ({ default: module.RecycleBinPage })),
);

function resolveActiveNav(pathname: string): NavId {
	return resolveNavFromPath(pathname) ?? 'dashboard';
}

export function ConsoleShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const activeNav = resolveActiveNav(location.pathname);
	const [profileNavigationIntent, setProfileNavigationIntent] = useState<{
		profileId: string;
		view: 'detail' | 'edit';
	} | null>(null);

	const {
		isRunning,
		setIsRunning,
		groups,
		deletedGroups,
		profiles,
		profileActionStates,
		proxies,
		profileProxyBindings,
		resources,
		resourceProgress,
		devicePresets,
		windowStates,
		createGroup,
		deleteGroup,
		restoreGroup,
		createProfile,
		updateProfile,
		updateProfileVisual,
		openProfile,
		closeProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		createDevicePreset,
		updateDevicePreset,
		deleteProfile,
		restoreProfile,
		refreshGroups,
		refreshProfiles,
		createProxy,
		deleteProxy,
		restoreProxy,
		bindProfileProxy,
		unbindProfileProxy,
		refreshProxies,
		refreshResources,
		refreshDevicePresets,
		installChromium,
		activateChromium,
		refreshWindows,
		openTab,
		closeTab,
		closeInactiveTabs,
		activateTab,
		activateTabByIndex,
		openWindow,
		closeWindow,
		focusWindow,
		setWindowBounds,
		batchOpenTabs,
		batchCloseTabs,
		batchCloseInactiveTabs,
		batchOpenWindows,
		batchFocusWindows,
	} = useConsoleState({
		onRequireSettings: () => navigate(NAV_PATHS.settings),
	});

	const {
		themeMode,
		setThemeMode,
		preset,
		setPreset,
		customColor,
		setCustomColor,
		useCustomColor,
		setUseCustomColor,
		resolvedMode,
	} = useThemeSettings();

	useEffect(() => {
		if (!isConsolePath(location.pathname)) {
			navigate(NAV_PATHS.dashboard, { replace: true });
		}
	}, [location.pathname, navigate]);

	const renderPage = () => {
		switch (activeNav) {
			case 'dashboard':
				return (
					<DashboardPage
						resolvedMode={resolvedMode}
						useCustomColor={useCustomColor}
						preset={preset}
					/>
				);
			case 'profiles':
				return (
					<ProfilesPage
						profiles={profiles}
						groups={groups}
						proxies={proxies}
						profileProxyBindings={profileProxyBindings}
						resources={resources}
						profileActionStates={profileActionStates}
						onCreateProfile={createProfile}
						onUpdateProfile={updateProfile}
						onUpdateProfileVisual={updateProfileVisual}
						onOpenProfile={openProfile}
						onCloseProfile={closeProfile}
						onBatchOpenProfiles={batchOpenProfiles}
						onBatchCloseProfiles={batchCloseProfiles}
					onDeleteProfile={deleteProfile}
					onRestoreProfile={restoreProfile}
					onRefreshProfiles={refreshProfiles}
					navigationIntent={profileNavigationIntent}
					onConsumeNavigationIntent={() => setProfileNavigationIntent(null)}
				/>
			);
			case 'groups':
				return (
					<GroupsPage
						groups={groups}
						onCreateGroup={createGroup}
						onDeleteGroup={deleteGroup}
					/>
				);
			case 'proxy':
				return (
					<ProxyPage
						proxies={proxies}
						profiles={profiles}
						profileProxyBindings={profileProxyBindings}
						onCreateProxy={createProxy}
						onDeleteProxy={deleteProxy}
						onRestoreProxy={restoreProxy}
						onBindProfileProxy={bindProfileProxy}
						onUnbindProfileProxy={unbindProfileProxy}
						onRefreshProxies={async () => {
							await Promise.all([refreshProxies(), refreshProfiles()]);
						}}
					/>
				);
			case 'ai':
				return <AiPage />;
			case 'windows':
				return (
					<WindowsPage
						profiles={profiles}
						windowStates={windowStates}
						onRefreshWindows={async () => {
							await refreshWindows();
						}}
						onViewProfile={(profileId) => {
							setProfileNavigationIntent({ profileId, view: 'detail' });
							navigate(NAV_PATHS.profiles);
						}}
						onOpenTab={openTab}
						onCloseTab={closeTab}
						onCloseInactiveTabs={closeInactiveTabs}
						onActivateTab={activateTab}
						onActivateTabByIndex={activateTabByIndex}
						onOpenWindow={openWindow}
						onCloseWindow={closeWindow}
						onFocusWindow={focusWindow}
						onSetWindowBounds={setWindowBounds}
						onBatchOpenTabs={batchOpenTabs}
						onBatchCloseTabs={batchCloseTabs}
						onBatchCloseInactiveTabs={batchCloseInactiveTabs}
						onBatchOpenWindows={batchOpenWindows}
						onBatchFocusWindows={batchFocusWindows}
					/>
				);
			case 'settings':
				if (location.pathname === SETTINGS_RECYCLE_BIN_PATH) {
					return (
						<RecycleBinPage
							profiles={profiles}
							proxies={proxies}
							groups={deletedGroups}
							onRestoreProfile={restoreProfile}
							onRestoreProxy={restoreProxy}
							onRestoreGroup={restoreGroup}
							onRefreshAll={async () => {
								await Promise.all([
									refreshProfiles(),
									refreshProxies(),
									refreshGroups(),
									refreshWindows(),
								]);
							}}
						/>
					);
				}
				return (
					<SettingsPage
						themeMode={themeMode}
						onThemeModeChange={setThemeMode}
						useCustomColor={useCustomColor}
						preset={preset}
						customColor={customColor}
						onPresetChange={(nextPreset) => {
							setUseCustomColor(false);
							setPreset(nextPreset);
						}}
						onCustomColorChange={(value) => {
							setUseCustomColor(true);
							setCustomColor(value);
						}}
						onToggleCustomColor={() => setUseCustomColor((prev) => !prev)}
						resources={resources}
						onRefreshResources={async () => {
							await refreshResources();
						}}
						onInstallChromium={installChromium}
						onActivateChromium={activateChromium}
						resourceProgress={resourceProgress}
						devicePresets={devicePresets}
						onCreateDevicePreset={createDevicePreset}
						onUpdateDevicePreset={updateDevicePreset}
						onRefreshDevicePresets={async () => {
							await refreshDevicePresets();
						}}
						onOpenRecycleBin={() => navigate(SETTINGS_RECYCLE_BIN_PATH)}
					/>
				);
			default:
				return null;
		}
	};

	const toasterTheme = resolvedMode === 'dark' ? 'dark' : 'light';
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
					isRunning={isRunning}
					onToggleRunning={() => setIsRunning((prev) => !prev)}
				/>

				<section className="flex h-full min-h-0 flex-col gap-3">
					<Card className="shrink-0 border-border/60 bg-card/84 p-4 backdrop-blur-2xl md:p-5">
						<ConsoleTopbar
							activeNav={activeNav}
							themeMode={themeMode}
							onThemeModeChange={setThemeMode}
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
								{renderPage()}
							</Suspense>
						</div>
					</Card>
				</section>
			</div>
			<Toaster theme={toasterTheme} />
		</div>
	);
}
