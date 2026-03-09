import { lazy } from 'react';

import { NAV_PATHS, SETTINGS_RECYCLE_BIN_PATH } from '@/features/console/routes';
import type { GroupItem } from '@/entities/group/model/types';
import type { CreateProxyPayload, ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem, ResourceProgressState } from '@/entities/resource/model/types';
import type { PresetKey, ThemeMode } from '@/entities/theme/model/types';
import type { ProfileWindowStateItem } from '@/entities/window-session/model/types';
import type { NavId } from '@/widgets/console-shell/model/types';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	ProfileDevicePresetItem,
	ProfileItem,
	ProfileProxyBindingMap,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';

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

type ProfileNavigationIntent = {
	profileId: string;
	view: 'detail' | 'edit';
} | null;

type ConsolePageContentProps = {
	activeNav: NavId;
	pathname: string;
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	groups: GroupItem[];
	deletedGroups: GroupItem[];
	profiles: ProfileItem[];
	profileActionStates: Record<string, ProfileActionState>;
	proxies: ProxyItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	resources: ResourceItem[];
	resourceProgress: ResourceProgressState | null;
	devicePresets: ProfileDevicePresetItem[];
	windowStates: ProfileWindowStateItem[];
	createGroup: (name: string, note: string) => Promise<void> | void;
	deleteGroup: (id: string) => Promise<void> | void;
	restoreGroup: (id: string) => Promise<void>;
	createProfile: (payload: CreateProfilePayload) => Promise<void>;
	updateProfile: (profileId: string, payload: CreateProfilePayload) => Promise<void>;
	updateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	openProfile: (profileId: string) => Promise<void>;
	closeProfile: (profileId: string) => Promise<void>;
	batchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	batchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	createDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	updateDevicePreset: (presetId: string, payload: SaveProfileDevicePresetPayload) => Promise<void>;
	deleteProfile: (profileId: string) => Promise<void>;
	restoreProfile: (profileId: string) => Promise<void>;
	refreshGroups: () => Promise<void>;
	refreshProfiles: () => Promise<void>;
	createProxy: (payload: CreateProxyPayload) => Promise<void>;
	deleteProxy: (proxyId: string) => Promise<void>;
	restoreProxy: (proxyId: string) => Promise<void>;
	bindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	unbindProfileProxy: (profileId: string) => Promise<void>;
	refreshProxies: () => Promise<void>;
	refreshResources: () => Promise<void>;
	refreshDevicePresets: () => Promise<void>;
	installChromium: (resourceId: string) => Promise<void>;
	activateChromium: (version: string) => Promise<void>;
	refreshWindows: () => Promise<void>;
	openTab: (profileId: string, url?: string) => Promise<void>;
	closeTab: (profileId: string, tabId?: number) => Promise<void>;
	closeInactiveTabs: (profileId: string, windowId?: number) => Promise<void>;
	activateTab: (profileId: string, tabId: number) => Promise<void>;
	activateTabByIndex: (profileId: string, index: number, windowId?: number) => Promise<void>;
	openWindow: (profileId: string, url?: string) => Promise<void>;
	closeWindow: (profileId: string, windowId?: number) => Promise<void>;
	focusWindow: (profileId: string, windowId?: number) => Promise<void>;
	setWindowBounds: (
		profileId: string,
		bounds: { x: number; y: number; width: number; height: number },
		windowId?: number,
	) => Promise<void>;
	batchOpenTabs: (profileIds: string[], url?: string) => Promise<void>;
	batchCloseTabs: (profileIds: string[]) => Promise<void>;
	batchCloseInactiveTabs: (profileIds: string[]) => Promise<void>;
	batchOpenWindows: (profileIds: string[], url?: string) => Promise<void>;
	batchFocusWindows: (profileIds: string[]) => Promise<void>;
	navigationIntent: ProfileNavigationIntent;
	onConsumeNavigationIntent: () => void;
	onSetProfileNavigationIntent: (intent: ProfileNavigationIntent) => void;
	onNavigate: (path: string) => void;
};

export function ConsolePageContent({
	activeNav,
	pathname,
	resolvedMode,
	useCustomColor,
	preset,
	customColor,
	themeMode,
	onThemeModeChange,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
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
	navigationIntent,
	onConsumeNavigationIntent,
	onSetProfileNavigationIntent,
	onNavigate,
}: ConsolePageContentProps) {
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
					navigationIntent={navigationIntent}
					onConsumeNavigationIntent={onConsumeNavigationIntent}
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
					onRefreshWindows={refreshWindows}
					onViewProfile={(profileId) => {
						onSetProfileNavigationIntent({ profileId, view: 'detail' });
						onNavigate(NAV_PATHS.profiles);
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
			if (pathname === SETTINGS_RECYCLE_BIN_PATH) {
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
					onThemeModeChange={onThemeModeChange}
					useCustomColor={useCustomColor}
					preset={preset}
					customColor={customColor}
					onPresetChange={onPresetChange}
					onCustomColorChange={onCustomColorChange}
					onToggleCustomColor={onToggleCustomColor}
					resources={resources}
					onRefreshResources={refreshResources}
					onInstallChromium={installChromium}
					onActivateChromium={activateChromium}
					resourceProgress={resourceProgress}
					devicePresets={devicePresets}
					onCreateDevicePreset={createDevicePreset}
					onUpdateDevicePreset={updateDevicePreset}
					onRefreshDevicePresets={refreshDevicePresets}
					onOpenRecycleBin={() => onNavigate(SETTINGS_RECYCLE_BIN_PATH)}
				/>
			);
		default:
			return null;
	}
}
