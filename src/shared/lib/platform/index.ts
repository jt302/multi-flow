export type ClientPlatform = 'macos' | 'windows' | 'linux';

export function detectClientPlatform(): ClientPlatform {
	if (typeof navigator === 'undefined') {
		return 'macos';
	}

	const navigatorWithUserAgentData = navigator as Navigator & {
		userAgentData?: {
			platform?: string;
		};
	};
	const userAgentDataPlatform =
		typeof navigatorWithUserAgentData.userAgentData?.platform === 'string'
			? navigatorWithUserAgentData.userAgentData.platform
			: '';
	const source = `${userAgentDataPlatform} ${navigator.userAgent}`.toLowerCase();

	if (source.includes('win')) {
		return 'windows';
	}
	if (source.includes('linux') || source.includes('x11')) {
		return 'linux';
	}
	return 'macos';
}
