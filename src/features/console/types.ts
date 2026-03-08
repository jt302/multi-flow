import type { LucideIcon } from 'lucide-react';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	ProfileDevicePresetItem,
	ProfileItem,
	ProfileProxyBindingMap,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
export type {
	BatchProfileActionItem,
	BatchProfileActionResponse,
	CreateProfilePayload,
	FingerprintSeedPolicy,
	FingerprintStrategy,
	FontListMode,
	ProfileActionState,
	ProfileAdvancedSettings,
	ProfileBasicSettings,
	ProfileDevicePresetItem,
	ProfileFingerprintSettings,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfileItem,
	ProfileLifecycle,
	ProfileProxyBindingMap,
	ProfileSettings,
	SaveProfileDevicePresetPayload,
	WebRtcMode,
} from '@/entities/profile/model/types';

export type ThemeMode = 'light' | 'dark' | 'system';
export type PresetKey = 'harbor' | 'olive' | 'copper' | 'slate';

export type Palette = {
	light: string;
	dark: string;
};

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

export type GroupItem = {
	id: string;
	name: string;
	note: string;
	profileCount: number;
	updatedAt: string;
	lifecycle: 'active' | 'deleted';
	deletedAt?: number | null;
};

export type ProxyLifecycle = 'active' | 'deleted';
export type ProxyProtocol = 'http' | 'https' | 'socks5' | 'ssh';

export type ProxyItem = {
	id: string;
	name: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	username: string;
	password: string;
	country: string;
	region: string;
	city: string;
	provider: string;
	note: string;
	lastStatus: string;
	lastCheckedAt: number | null;
	lifecycle: ProxyLifecycle;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
};

export type CreateProxyPayload = {
	name: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	username?: string;
	password?: string;
	country?: string;
	region?: string;
	city?: string;
	provider?: string;
	note?: string;
};

export type ResourceItem = {
	id: string;
	kind: string;
	version: string;
	platform: string;
	url: string;
	fileName: string;
	installed: boolean;
	localPath: string | null;
	active: boolean;
};

export type ResourceProgressState = {
	resourceId: string;
	stage: string;
	percent: number | null;
	downloadedBytes: number;
	totalBytes: number | null;
	message: string;
};

export type WindowTabItem = {
	tabId: number;
	title: string;
	url: string;
	active: boolean;
};

export type WindowBoundsItem = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ProfileWindowItem = {
	windowId: number;
	focused: boolean;
	tabCount: number;
	activeTabId: number | null;
	activeTabUrl: string | null;
	bounds?: WindowBoundsItem | null;
	tabs: WindowTabItem[];
};

export type ProfileWindowStateItem = {
	profileId: string;
	sessionId: number;
	pid: number | null;
	totalWindows: number;
	totalTabs: number;
	windows: ProfileWindowItem[];
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

export type ThemeCustomizerCardProps = {
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
};

export type GroupsPageProps = {
	groups: GroupItem[];
	onCreateGroup: (name: string, note: string) => Promise<void> | void;
	onDeleteGroup: (id: string) => Promise<void> | void;
};

export type RecycleBinPageProps = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	groups: GroupItem[];
	onRestoreProfile: (profileId: string) => Promise<void>;
	onRestoreProxy: (proxyId: string) => Promise<void>;
	onRestoreGroup: (groupId: string) => Promise<void>;
	onRefreshAll: () => Promise<void>;
};

export type ProfilesPageProps = {
	profiles: ProfileItem[];
	groups: GroupItem[];
	proxies: ProxyItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	resources: ResourceItem[];
	profileActionStates: Record<string, ProfileActionState>;
	onCreateProfile: (payload: CreateProfilePayload) => Promise<void>;
	onUpdateProfile: (profileId: string, payload: CreateProfilePayload) => Promise<void>;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onBatchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onRefreshProfiles: () => Promise<void>;
	navigationIntent?: {
		profileId: string;
		view: 'detail' | 'edit';
	} | null;
	onConsumeNavigationIntent?: () => void;
};

export type ProxyPageProps = {
	proxies: ProxyItem[];
	profiles: ProfileItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	onCreateProxy: (payload: CreateProxyPayload) => Promise<void>;
	onDeleteProxy: (proxyId: string) => Promise<void>;
	onRestoreProxy: (proxyId: string) => Promise<void>;
	onBindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	onUnbindProfileProxy: (profileId: string) => Promise<void>;
	onRefreshProxies: () => Promise<void>;
};

export type WindowsPageProps = {
	profiles: ProfileItem[];
	windowStates: ProfileWindowStateItem[];
	onRefreshWindows: () => Promise<void>;
	onViewProfile: (profileId: string) => void;
	onOpenTab: (profileId: string, url?: string) => Promise<void>;
	onCloseTab: (profileId: string, tabId?: number) => Promise<void>;
	onCloseInactiveTabs: (profileId: string, windowId?: number) => Promise<void>;
	onActivateTab: (profileId: string, tabId: number) => Promise<void>;
	onActivateTabByIndex: (profileId: string, index: number, windowId?: number) => Promise<void>;
	onOpenWindow: (profileId: string, url?: string) => Promise<void>;
	onCloseWindow: (profileId: string, windowId?: number) => Promise<void>;
	onFocusWindow: (profileId: string, windowId?: number) => Promise<void>;
	onSetWindowBounds: (profileId: string, bounds: WindowBoundsItem, windowId?: number) => Promise<void>;
	onBatchOpenTabs: (profileIds: string[], url?: string) => Promise<void>;
	onBatchCloseTabs: (profileIds: string[]) => Promise<void>;
	onBatchCloseInactiveTabs: (profileIds: string[]) => Promise<void>;
	onBatchOpenWindows: (profileIds: string[], url?: string) => Promise<void>;
	onBatchFocusWindows: (profileIds: string[]) => Promise<void>;
};

export type SettingsPageProps = {
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	resources: ResourceItem[];
	onRefreshResources: () => Promise<void>;
	onInstallChromium: (resourceId: string) => Promise<void>;
	onActivateChromium: (version: string) => Promise<void>;
	resourceProgress: ResourceProgressState | null;
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
	) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
	onOpenRecycleBin?: () => void;
};
