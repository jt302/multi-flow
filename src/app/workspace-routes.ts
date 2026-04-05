import type { NavId } from './model/workspace-types';

export const NAV_PATHS: Record<NavId, string> = {
	dashboard: '/dashboard',
	profiles: '/profiles',
	plugins: '/plugins',
	groups: '/groups',
	proxy: '/proxy',
	windows: '/windows',
	'browser-control': '/browser-control',
	automation: '/automation',
	'ai-chat': '/ai-chat',
	settings: '/settings',
};

export const PROFILES_DEVICE_PRESETS_PATH = '/profiles/device-presets';

const PATH_TO_NAV: Record<string, NavId> = Object.entries(NAV_PATHS).reduce(
	(acc, [nav, path]) => {
		acc[path] = nav as NavId;
		return acc;
	},
	{} as Record<string, NavId>,
);

PATH_TO_NAV[PROFILES_DEVICE_PRESETS_PATH] = 'profiles';

export function resolveNavFromPath(pathname: string): NavId | null {
	if (!pathname) {
		return null;
	}

	const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
	return PATH_TO_NAV[normalized] ?? null;
}

export function resolvePathFromNav(nav: NavId): string {
	return NAV_PATHS[nav];
}

export function isWorkspacePath(pathname: string): boolean {
	return resolveNavFromPath(pathname) !== null;
}
