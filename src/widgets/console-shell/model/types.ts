import type { LucideIcon } from 'lucide-react';

import type { GroupItem } from '@/entities/group/model/types';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	ProfileDevicePresetItem,
	ProfileItem,
	ProfileProxyBindingMap,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
import type { CreateProxyPayload, ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem, ResourceProgressState } from '@/entities/resource/model/types';
import type { PresetKey } from '@/entities/theme/model/types';
import type { ThemeMode } from '@/entities/theme/model/types';
import type { ProfileWindowStateItem } from '@/entities/window-session/model/types';

export type NavId = 'dashboard' | 'profiles' | 'groups' | 'proxy' | 'windows' | 'ai' | 'settings';

export type NavItem = {
	id: NavId;
	label: string;
	icon: LucideIcon;
};

export type SessionRow = {
	name: string;
	group: string;
	status: string;
	geo: string;
	last: string;
};

export type NavSection = {
	title: string;
	desc: string;
	tableTitle: string;
	rows: SessionRow[];
};

export type ConsoleSidebarProps = {
	activeNav: NavId;
	onNavChange: (nav: NavId) => void;
	isRunning: boolean;
	onToggleRunning: () => void;
};

export type ConsoleTopbarProps = {
	activeNav: NavId;
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	onOpenLogPanel?: () => void;
};

export type MetricsGridProps = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
};

export type ActiveSectionCardProps = {
	label: string;
	title: string;
	description: string;
};

export type SessionTableCardProps = {
	title: string;
	rows: SessionRow[];
};

export type ProfileNavigationIntent = {
	profileId: string;
	view: 'detail' | 'edit';
} | null;

export type ConsolePageThemeState = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
};

export type ConsolePageThemeActions = {
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
};

export type ConsolePageData = {
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
};

export type ConsolePageActions = {
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
};

export type ConsolePageNavigation = {
	pathname: string;
	intent: ProfileNavigationIntent;
	onConsumeNavigationIntent: () => void;
	onSetProfileNavigationIntent: (intent: ProfileNavigationIntent) => void;
	onNavigate: (path: string) => void;
};
