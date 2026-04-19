const ALL_TIMEZONES: string[] = (() => {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (Intl as any).supportedValuesOf('timeZone') as string[];
	} catch {
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
	}
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
