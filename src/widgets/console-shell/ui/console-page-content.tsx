import { lazy } from 'react';

import { NAV_PATHS, SETTINGS_RECYCLE_BIN_PATH } from '@/features/console/routes';
import type {
	ConsolePageActions,
	ConsolePageData,
	ConsolePageNavigation,
	ConsolePageThemeActions,
	ConsolePageThemeState,
	NavId,
} from '@/widgets/console-shell/model/types';

const DashboardPage = lazy(() =>
	import('@/features/dashboard/ui/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const ProfilesPage = lazy(() =>
	import('@/features/profile/ui/profiles-page').then((module) => ({ default: module.ProfilesPage })),
);
const GroupsPage = lazy(() =>
	import('@/features/group/ui/groups-page').then((module) => ({ default: module.GroupsPage })),
);
const ProxyPage = lazy(() =>
	import('@/features/proxy/ui/proxy-page').then((module) => ({ default: module.ProxyPage })),
);
const WindowsPage = lazy(() =>
	import('@/features/window-session/ui/windows-page').then((module) => ({ default: module.WindowsPage })),
);
const AiPage = lazy(() =>
	import('@/features/ai/ui/ai-page').then((module) => ({ default: module.AiPage })),
);
const SettingsPage = lazy(() =>
	import('@/features/settings/ui/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const RecycleBinPage = lazy(() =>
	import('@/features/recycle-bin/ui/recycle-bin-page').then((module) => ({ default: module.RecycleBinPage })),
);

type ConsolePageContentProps = {
	activeNav: NavId;
	theme: ConsolePageThemeState & ConsolePageThemeActions;
	data: ConsolePageData;
	actions: ConsolePageActions;
	navigation: ConsolePageNavigation;
};

export function ConsolePageContent({
	activeNav,
	theme,
	data,
	actions,
	navigation,
}: ConsolePageContentProps) {
	switch (activeNav) {
		case 'dashboard':
			return (
				<DashboardPage
					resolvedMode={theme.resolvedMode}
					useCustomColor={theme.useCustomColor}
					preset={theme.preset}
				/>
			);
		case 'profiles':
			return (
				<ProfilesPage
					profiles={data.profiles}
					groups={data.groups}
					proxies={data.proxies}
					profileProxyBindings={data.profileProxyBindings}
					resources={data.resources}
					profileActionStates={data.profileActionStates}
					onCreateProfile={actions.createProfile}
					onUpdateProfile={actions.updateProfile}
					onUpdateProfileVisual={actions.updateProfileVisual}
					onOpenProfile={actions.openProfile}
					onCloseProfile={actions.closeProfile}
					onFocusProfileWindow={actions.focusWindow}
					onBatchOpenProfiles={actions.batchOpenProfiles}
					onBatchCloseProfiles={actions.batchCloseProfiles}
					onDeleteProfile={actions.deleteProfile}
					onRestoreProfile={actions.restoreProfile}
					onRefreshProfiles={actions.refreshProfiles}
					navigationIntent={navigation.intent}
					onConsumeNavigationIntent={navigation.onConsumeNavigationIntent}
				/>
			);
		case 'groups':
			return (
				<GroupsPage
					groups={data.groups}
					onCreateGroup={actions.createGroup}
					onDeleteGroup={actions.deleteGroup}
				/>
			);
		case 'proxy':
			return (
				<ProxyPage
					proxies={data.proxies}
					profiles={data.profiles}
					profileProxyBindings={data.profileProxyBindings}
					onCreateProxy={actions.createProxy}
					onDeleteProxy={actions.deleteProxy}
					onRestoreProxy={actions.restoreProxy}
					onBindProfileProxy={actions.bindProfileProxy}
					onUnbindProfileProxy={actions.unbindProfileProxy}
					onRefreshProxies={async () => {
						await Promise.all([actions.refreshProxies(), actions.refreshProfiles()]);
					}}
				/>
			);
		case 'ai':
			return <AiPage />;
		case 'windows':
			return (
				<WindowsPage
					profiles={data.profiles}
					windowStates={data.windowStates}
					onRefreshWindows={actions.refreshWindows}
					onViewProfile={(profileId) => {
						navigation.onSetProfileNavigationIntent({ profileId, view: 'detail' });
						navigation.onNavigate(NAV_PATHS.profiles);
					}}
					onOpenTab={actions.openTab}
					onCloseTab={actions.closeTab}
					onCloseInactiveTabs={actions.closeInactiveTabs}
					onActivateTab={actions.activateTab}
					onActivateTabByIndex={actions.activateTabByIndex}
					onOpenWindow={actions.openWindow}
					onCloseWindow={actions.closeWindow}
					onFocusWindow={actions.focusWindow}
					onSetWindowBounds={actions.setWindowBounds}
					onBatchOpenTabs={actions.batchOpenTabs}
					onBatchCloseTabs={actions.batchCloseTabs}
					onBatchCloseInactiveTabs={actions.batchCloseInactiveTabs}
					onBatchOpenWindows={actions.batchOpenWindows}
					onBatchFocusWindows={actions.batchFocusWindows}
				/>
			);
		case 'settings':
			if (navigation.pathname === SETTINGS_RECYCLE_BIN_PATH) {
				return (
					<RecycleBinPage
						profiles={data.profiles}
						proxies={data.proxies}
						groups={data.deletedGroups}
						onRestoreProfile={actions.restoreProfile}
						onRestoreProxy={actions.restoreProxy}
						onRestoreGroup={actions.restoreGroup}
						onRefreshAll={async () => {
							await Promise.all([
								actions.refreshProfiles(),
								actions.refreshProxies(),
								actions.refreshGroups(),
								actions.refreshWindows(),
							]);
						}}
					/>
				);
			}
			return (
				<SettingsPage
					useCustomColor={theme.useCustomColor}
					preset={theme.preset}
					customColor={theme.customColor}
					onPresetChange={theme.onPresetChange}
					onCustomColorChange={theme.onCustomColorChange}
					onToggleCustomColor={theme.onToggleCustomColor}
					resources={data.resources}
					onRefreshResources={actions.refreshResources}
					onInstallChromium={actions.installChromium}
					onActivateChromium={actions.activateChromium}
					resourceProgress={data.resourceProgress}
					devicePresets={data.devicePresets}
					onCreateDevicePreset={actions.createDevicePreset}
					onUpdateDevicePreset={actions.updateDevicePreset}
					onRefreshDevicePresets={actions.refreshDevicePresets}
					onOpenRecycleBin={() => navigation.onNavigate(SETTINGS_RECYCLE_BIN_PATH)}
				/>
			);
		default:
			return null;
	}
}
