import type { ProfileItem } from '@/entities/profile/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import type { PlatformVisualMeta } from '@/entities/profile/lib/platform-meta';
import { getPlatformMeta } from '@/entities/profile/lib/platform-meta';
import { detectClientPlatform } from '@/shared/lib/platform';
import i18next from 'i18next';

export type ProfileListRunningFilter = 'all' | 'running' | 'stopped';
export type ProfileListLifecycleFilter = 'all' | 'active' | 'deleted';

export type ProfileListFiltersState = {
	keyword: string;
	groupFilter: string;
	runningFilter: ProfileListRunningFilter;
	lifecycleFilter: ProfileListLifecycleFilter;
};

export function formatProfileTime(unixTs: number | null): string {
	if (!unixTs) {
		return i18next.t('profile:time.notStarted');
	}
	const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixTs);
	if (diff < 60) {
		return i18next.t('profile:time.justNow');
	}
	if (diff < 3600) {
		return i18next.t('profile:time.minutesAgo', { count: Math.floor(diff / 60) });
	}
	if (diff < 86400) {
		return i18next.t('profile:time.hoursAgo', { count: Math.floor(diff / 3600) });
	}
	return i18next.t('profile:time.daysAgo', { count: Math.floor(diff / 86400) });
}

export function resolvePlatformMeta(profile: ProfileItem): PlatformVisualMeta {
	const platform =
		profile.settings?.basic?.platform?.trim().toLowerCase() ?? detectClientPlatform();
	return getPlatformMeta(platform);
}

export function filterProfiles(profiles: ProfileItem[], filters: ProfileListFiltersState) {
	const query = filters.keyword.trim().toLowerCase();
	return profiles.filter((item) => {
		if (filters.lifecycleFilter !== 'all' && item.lifecycle !== filters.lifecycleFilter) {
			return false;
		}
		if (filters.runningFilter === 'running' && !item.running) {
			return false;
		}
		if (filters.runningFilter === 'stopped' && item.running) {
			return false;
		}
		if (filters.groupFilter !== 'all' && item.group !== filters.groupFilter) {
			return false;
		}
		if (!query) {
			return true;
		}
		const haystack = `${item.name} ${item.group} ${item.note}`.toLowerCase();
		return haystack.includes(query);
	});
}

export function resolveBrowserVersionMeta(
	profile: ProfileItem,
	resources: ResourceItem[],
): {
	versionLabel: string;
	resourceLabel: string;
} {
	const browserVersion = profile.settings?.basic?.browserVersion?.trim();
	if (!browserVersion) {
		return {
			versionLabel: i18next.t('common:autoSelect'),
			resourceLabel: i18next.t('profile:basic.versionAutoResolve'),
		};
	}
	const hostPlatform = detectClientPlatform();
	const resource = resources.find(
		(item) =>
			item.kind === 'chromium' &&
			item.platform === hostPlatform &&
			item.version === browserVersion,
	);
	return {
		versionLabel: browserVersion,
		resourceLabel: resource
			? resource.installed
				? i18next.t('common:installed')
				: i18next.t('profile:basic.versionNoResource')
			: i18next.t('profile:basic.versionNotAvailable'),
	};
}
