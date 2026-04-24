const ALL_TIMEZONES: string[] = (() => {
	try {
		const supportedValuesOf = (
			Intl as typeof Intl & {
				supportedValuesOf?: (key: 'timeZone') => string[];
			}
		).supportedValuesOf;
		const timeZones = supportedValuesOf?.('timeZone');
		if (timeZones?.length) {
			return timeZones;
		}
	} catch {
		// 回退到下方内置常用时区列表。
	}
	return [
		'UTC',
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'Europe/London',
		'Europe/Paris',
		'Europe/Berlin',
		'Asia/Shanghai',
		'Asia/Tokyo',
		'Asia/Seoul',
		'Asia/Singapore',
		'Asia/Kolkata',
		'Australia/Sydney',
		'Pacific/Auckland',
	];
})();

export const TIMEZONE_LIST: string[] = ALL_TIMEZONES;

export const TIMEZONE_SET: Set<string> = new Set(ALL_TIMEZONES);

export function searchTimezones(query: string): string[] {
	if (!query.trim()) {
		return TIMEZONE_LIST;
	}
	const lower = query.toLowerCase();
	return TIMEZONE_LIST.filter((tz) => tz.toLowerCase().includes(lower));
}
