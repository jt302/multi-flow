import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

export type RecycleBinPageProps = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	groups: GroupItem[];
	onRestoreProfile: (profileId: string) => Promise<void>;
	onPurgeProfile: (profileId: string) => Promise<void>;
	onRestoreProxy: (proxyId: string) => Promise<void>;
	onPurgeProxy: (proxyId: string) => Promise<void>;
	onRestoreGroup: (groupId: string) => Promise<void>;
	onPurgeGroup: (groupId: string) => Promise<void>;
	onRefreshAll: () => Promise<void>;
};
