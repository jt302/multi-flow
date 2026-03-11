export const SIDEBAR_COOKIE_NAME = 'sidebar_state';
export const SIDEBAR_STORAGE_KEY = 'multi-flow.sidebar.open';

function parseBoolean(raw: string | null | undefined): boolean | null {
	if (!raw) {
		return null;
	}
	const normalized = raw.trim().toLowerCase();
	if (normalized === 'true') {
		return true;
	}
	if (normalized === 'false') {
		return false;
	}
	return null;
}

export function parseSidebarOpenFromCookie(cookieText: string): boolean | null {
	if (!cookieText.trim()) {
		return null;
	}
	const token = cookieText
		.split(';')
		.map((chunk) => chunk.trim())
		.find((chunk) => chunk.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
	if (!token) {
		return null;
	}
	const [, rawValue = ''] = token.split('=');
	return parseBoolean(decodeURIComponent(rawValue));
}

export function resolveInitialSidebarOpen(params: {
	cookieText: string;
	storageValue: string | null;
}): boolean {
	const fromCookie = parseSidebarOpenFromCookie(params.cookieText);
	if (fromCookie !== null) {
		return fromCookie;
	}
	const fromStorage = parseBoolean(params.storageValue);
	return fromStorage ?? true;
}

export function persistSidebarOpen(open: boolean): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? 'true' : 'false');
}
