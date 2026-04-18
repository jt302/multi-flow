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

export type BrowserBoundsSnapshot = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type ActiveBrowserSnapshot = {
	bounds?: BrowserBoundsSnapshot | null;
	maximized?: boolean | null;
	minimized?: boolean | null;
	fullscreen?: boolean | null;
	tabCount?: number | null;
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

export type LocalSyncTargetItem = ProfileWindowStateItem & {
	label: string;
	host: string;
	magicSocketServerPort: number | null;
};

export type SyncRole = 'none' | 'master' | 'slave';
export type WindowArrangeMode = 'grid' | 'cascade' | 'main_with_sidebar';
export type LastRowAlign = 'start' | 'center' | 'stretch';
export type ArrangeFlow = 'row_major' | 'col_major';
export type MainPosition = 'left' | 'right' | 'top' | 'bottom';
export type ChromeDecorationCompensation = 'auto' | 'off';
export type ArrangeOrder = 'selection' | 'name';

export type EdgeInsets = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};
export type SyncManagerConnectionStatus =
	| 'idle'
	| 'starting'
	| 'connected'
	| 'disconnected'
	| 'error';
export type SyncManagerInstanceStatus = 'unknown' | 'online' | 'offline' | 'unhealthy';

export type SyncManagerInstanceInfo = {
	id: string;
	host: string;
	port: number;
	status: SyncManagerInstanceStatus;
	label?: string | null;
	platform?: string | null;
	lastDropReason?: string | null;
	activeBrowser?: ActiveBrowserSnapshot | null;
	supportsNativeReplay?: boolean | null;
	captureBackend?: string | null;
	injectBackend?: string | null;
	magicSocketServerPort?: number | null;
	boundBrowserId?: number | null;
	boundWindowToken?: string | null;
	coordinateMode?: string | null;
	wsStatusVerified: boolean;
	lastProbeError?: string | null;
};

export type SyncMetrics = {
	eventsReceived: number;
	eventsForwarded: number;
	eventsFailed: number;
	eventsDroppedInvalid: number;
	eventsDroppedSessionMismatch: number;
	eventsDroppedNonReplayable: number;
	eventsDroppedPlatformMismatch: number;
};

export type SyncSession = {
	sessionId: string;
	masterId: string;
	slaveIds: string[];
	status: 'starting' | 'running' | 'stopping' | 'stopped';
};

export type SyncSessionPayload = {
	session: SyncSession | null;
	metrics: SyncMetrics;
	master: SyncManagerInstanceInfo | null;
	slaves: SyncManagerInstanceInfo[];
	reason: string | null;
};

export type SyncWarningItem = {
	code: string;
	scope: string;
	message: string;
	instanceId?: string | null;
	eventFamily?: string | null;
	eventType?: string | null;
};

export type SyncTargetItem = LocalSyncTargetItem & {
	syncRole: SyncRole;
	instanceStatus: SyncManagerInstanceStatus;
	platform?: string | null;
	wsStatusVerified: boolean;
	lastProbeError?: string | null;
	lastDropReason?: string | null;
	boundBrowserId?: number | null;
	boundWindowToken?: string | null;
	coordinateMode?: string | null;
	activeBrowser?: ActiveBrowserSnapshot | null;
	isProbeReady: boolean;
};

export type ListSyncTargetsResponse = {
	items: LocalSyncTargetItem[];
};

export type DisplayMonitorItem = {
	id: string;
	name: string;
	isPrimary: boolean;
	isBuiltin: boolean;
	friendlyName?: string | null;
	manufacturer?: string | null;
	model?: string | null;
	hostDeviceName?: string | null;
	scaleFactor: number;
	positionX: number;
	positionY: number;
	width: number;
	height: number;
	workArea: WindowBoundsItem;
};

export type ArrangeWindowsPayload = {
	profileIds: string[];
	monitorId: string;
	mode: WindowArrangeMode;
	// grid 专用（fill 语义）
	rows?: number | null;
	columns?: number | null;
	gapX?: number;
	gapY?: number;
	padding?: EdgeInsets;
	lastRowAlign?: LastRowAlign;
	flow?: ArrangeFlow;
	// cascade 专用
	width?: number | null;
	height?: number | null;
	cascadeStep?: number;
	// mainWithSidebar 专用
	mainRatio?: number;
	mainPosition?: MainPosition;
	// 通用
	order?: ArrangeOrder;
	chromeDecorationCompensation?: ChromeDecorationCompensation;
	// 向后兼容
	gap?: number;
};

export type EnsureSyncSidecarStartedResponse = {
	port: number;
	alreadyRunning: boolean;
};
