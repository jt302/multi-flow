export type ProfileLifecycle = 'active' | 'deleted';
export type ProfileActionState =
	| 'opening'
	| 'closing'
	| 'deleting'
	| 'restoring'
	| 'recovering';

export type WebRtcMode = 'real' | 'follow_ip' | 'replace' | 'disable';
export type FingerprintStrategy = 'template' | 'random_bundle';
export type FingerprintSeedPolicy = 'fixed' | 'per_launch';
export type FontListMode = 'preset' | 'random' | 'custom';

export type ProfileBasicSettings = {
	browserKind?: string;
	browserVersion?: string;
	platform?: string;
	devicePresetId?: string;
	startupUrls?: string[];
	startupUrl?: string;
	browserBgColor?: string;
	toolbarText?: string;
};

export type ProfileDevicePresetItem = {
	id: string;
	label: string;
	platform: string;
	platformVersion: string;
	viewportWidth: number;
	viewportHeight: number;
	deviceScaleFactor: number;
	touchPoints: number;
	customPlatform: string;
	arch: string;
	bitness: string;
	mobile: boolean;
	formFactor: string;
	userAgentTemplate: string;
	customGlVendor: string;
	customGlRenderer: string;
	customCpuCores: number;
	customRamGb: number;
};

export type SaveProfileDevicePresetPayload = {
	label: string;
	platform: string;
	platformVersion: string;
	viewportWidth: number;
	viewportHeight: number;
	deviceScaleFactor: number;
	touchPoints: number;
	customPlatform: string;
	arch: string;
	bitness: string;
	mobile: boolean;
	formFactor: string;
	userAgentTemplate: string;
	customGlVendor: string;
	customGlRenderer: string;
	customCpuCores: number;
	customRamGb: number;
};

export type ProfileFingerprintSource = {
	platform?: string;
	devicePresetId?: string;
	browserVersion?: string;
	strategy?: FingerprintStrategy;
	seedPolicy?: FingerprintSeedPolicy;
	catalogVersion?: string;
};

export type ProfileFingerprintSnapshot = {
	browserVersion?: string;
	platform?: string;
	platformVersion?: string;
	presetLabel?: string;
	formFactor?: string;
	mobile?: boolean;
	userAgent?: string;
	customUaMetadata?: string;
	customPlatform?: string;
	customCpuCores?: number;
	customRamGb?: number;
	customGlVendor?: string;
	customGlRenderer?: string;
	customTouchPoints?: number;
	customFontList?: string[];
	language?: string;
	acceptLanguages?: string;
	timeZone?: string;
	windowWidth?: number;
	windowHeight?: number;
	deviceScaleFactor?: number;
	fingerprintSeed?: number;
};

export type ProfileFingerprintSettings = {
	fingerprintSource?: ProfileFingerprintSource;
	fingerprintSnapshot?: ProfileFingerprintSnapshot;
	language?: string;
	timezoneId?: string;
	fontListMode?: FontListMode;
	customFontList?: string[];
	webRtcMode?: WebRtcMode;
	webrtcIpOverride?: string;
};

export type ProfileAdvancedSettings = {
	headless?: boolean;
	disableImages?: boolean;
	geolocationMode?: 'off' | 'ip' | 'custom';
	autoAllowGeolocation?: boolean;
	customLaunchArgs?: string[];
	randomFingerprint?: boolean;
	fixedFingerprintSeed?: number;
	geolocation?: {
		latitude: number;
		longitude: number;
		accuracy?: number;
	};
};

export type ProfileSettings = {
	basic?: ProfileBasicSettings;
	fingerprint?: ProfileFingerprintSettings;
	advanced?: ProfileAdvancedSettings;
};

export type ProfileItem = {
	id: string;
	name: string;
	group: string;
	note: string;
	settings?: ProfileSettings;
	lifecycle: ProfileLifecycle;
	running: boolean;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
	lastOpenedAt: number | null;
};

export type ProfileRuntimeHandle = {
	profileId: string;
	sessionId: number;
	pid: number | null;
	debugPort: number | null;
	magicPort: number | null;
};

export type ProfileRuntimeDetails = {
	profileId: string;
	profileRootDir: string;
	userDataDir: string;
	cacheDataDir: string;
	runtimeHandle: ProfileRuntimeHandle | null;
	launchArgs: string[] | null;
	extraArgs: string[] | null;
};

export type ClearProfileCacheResponse = {
	profileId: string;
	cacheDataDir: string;
};

export type CreateProfilePayload = {
	name: string;
	group?: string;
	note?: string;
	proxyId?: string;
	settings?: ProfileSettings;
};

export type ProfileProxyBindingMap = Record<string, string>;

export type BatchProfileActionItem = {
	profileId: string;
	ok: boolean;
	message: string;
};

export type BatchProfileActionResponse = {
	total: number;
	successCount: number;
	failedCount: number;
	items: BatchProfileActionItem[];
};
