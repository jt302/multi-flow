import type { ProfileItem } from '@/entities/profile/model/types';
import type { ResourceItem } from '@/features/console/types';
import type { PlatformVisualMeta } from '@/features/console/utils/platform-meta';
import { detectClientPlatform } from '@/features/console/utils/platform';
import { getPlatformMeta } from '@/features/console/utils/platform-meta';

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
		return '未启动';
	}
	const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixTs);
	if (diff < 60) {
		return '刚刚';
	}
	if (diff < 3600) {
		return `${Math.floor(diff / 60)} 分钟前`;
	}
	if (diff < 86400) {
		return `${Math.floor(diff / 3600)} 小时前`;
	}
	return `${Math.floor(diff / 86400)} 天前`;
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
			versionLabel: '自动选择',
			resourceLabel: '启动时按宿主系统最新版本解析',
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
				? '已安装'
				: '未下载，启动时自动下载'
			: '当前宿主系统无该版本资源',
	};
}
