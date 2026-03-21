import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

type DeletedRecycleBinCountInput = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	groups: GroupItem[];
};

export function countDeletedRecycleBinItems({
	profiles,
	proxies,
	groups,
}: DeletedRecycleBinCountInput): number {
	return (
		profiles.filter((item) => item.lifecycle === 'deleted').length +
		proxies.filter((item) => item.lifecycle === 'deleted').length +
		groups.filter((item) => item.lifecycle === 'deleted').length
	);
}
