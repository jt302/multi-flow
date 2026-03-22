import type { NavId } from './model/workspace-types';

export const NAV_PATHS: Record<NavId, string> = {
	dashboard: '/dashboard',
	profiles: '/profiles',
	plugins: '/plugins',
	groups: '/groups',
	proxy: '/proxy',
	windows: '/windows',
	settings: '/settings',
};

export const SETTINGS_RECYCLE_BIN_PATH = '/settings/recycle-bin';

const PATH_TO_NAV: Record<string, NavId> = Object.entries(NAV_PATHS).reduce(
	(acc, [nav, path]) => {
		acc[path] = nav as NavId;
		return acc;
	},
	{} as Record<string, NavId>,
);

PATH_TO_NAV[SETTINGS_RECYCLE_BIN_PATH] = 'settings';

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
	if (pathname === SETTINGS_RECYCLE_BIN_PATH) {
		return true;
	}
	return resolveNavFromPath(pathname) !== null;
}
