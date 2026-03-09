import { Suspense, useEffect } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, Toaster } from '@/components/ui';
import { openLogPanelWindow } from '@/features/logs';
import { useThemeSettings } from '@/features/console/hooks';
import { ConsoleSidebar, ConsoleTopbar } from '@/features/console/components';
import { useConsoleState } from '@/features/console/hooks';
import { ConsolePageContent } from './console-page-content';
import {
	isConsolePath,
	NAV_PATHS,
	resolveNavFromPath,
	resolvePathFromNav,
} from '@/features/console/routes';
import type { NavId } from '@/features/console/types';

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
								<ConsolePageContent
									activeNav={activeNav}
									pathname={location.pathname}
									resolvedMode={resolvedMode}
									useCustomColor={useCustomColor}
									preset={preset}
									customColor={customColor}
									themeMode={themeMode}
									onThemeModeChange={setThemeMode}
									onPresetChange={(nextPreset) => {
										setUseCustomColor(false);
										setPreset(nextPreset);
									}}
									onCustomColorChange={(value) => {
										setUseCustomColor(true);
										setCustomColor(value);
									}}
									onToggleCustomColor={() => setUseCustomColor((prev) => !prev)}
									groups={groups}
									deletedGroups={deletedGroups}
									profiles={profiles}
									profileActionStates={profileActionStates}
									proxies={proxies}
									profileProxyBindings={profileProxyBindings}
									resources={resources}
									resourceProgress={resourceProgress}
									devicePresets={devicePresets}
									windowStates={windowStates}
									createGroup={createGroup}
									deleteGroup={deleteGroup}
									restoreGroup={restoreGroup}
									createProfile={createProfile}
									updateProfile={updateProfile}
									updateProfileVisual={updateProfileVisual}
									openProfile={openProfile}
									closeProfile={closeProfile}
									batchOpenProfiles={batchOpenProfiles}
									batchCloseProfiles={batchCloseProfiles}
									createDevicePreset={createDevicePreset}
									updateDevicePreset={updateDevicePreset}
									deleteProfile={deleteProfile}
									restoreProfile={restoreProfile}
									refreshGroups={refreshGroups}
									refreshProfiles={refreshProfiles}
									createProxy={createProxy}
									deleteProxy={deleteProxy}
									restoreProxy={restoreProxy}
									bindProfileProxy={bindProfileProxy}
									unbindProfileProxy={unbindProfileProxy}
									refreshProxies={refreshProxies}
									refreshResources={refreshResources}
									refreshDevicePresets={refreshDevicePresets}
									installChromium={installChromium}
									activateChromium={activateChromium}
									refreshWindows={refreshWindows}
									openTab={openTab}
									closeTab={closeTab}
									closeInactiveTabs={closeInactiveTabs}
									activateTab={activateTab}
									activateTabByIndex={activateTabByIndex}
									openWindow={openWindow}
									closeWindow={closeWindow}
									focusWindow={focusWindow}
									setWindowBounds={setWindowBounds}
									batchOpenTabs={batchOpenTabs}
									batchCloseTabs={batchCloseTabs}
									batchCloseInactiveTabs={batchCloseInactiveTabs}
									batchOpenWindows={batchOpenWindows}
									batchFocusWindows={batchFocusWindows}
									navigationIntent={profileNavigationIntent}
									onConsumeNavigationIntent={() => setProfileNavigationIntent(null)}
									onSetProfileNavigationIntent={setProfileNavigationIntent}
									onNavigate={(path) => navigate(path)}
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
