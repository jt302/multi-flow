import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { RpaFlowItem } from '@/entities/rpa/model/types';

type DeletedRecycleBinCountInput = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	groups: GroupItem[];
	rpaFlows: RpaFlowItem[];
};

export function getDeletedRpaFlows(flows: RpaFlowItem[]): RpaFlowItem[] {
	return [...flows]
		.filter((flow) => flow.lifecycle === 'deleted')
		.sort((left, right) => {
			const rightTs = right.deletedAt ?? right.updatedAt;
			const leftTs = left.deletedAt ?? left.updatedAt;
			return rightTs - leftTs;
		});
}

export function countDeletedRecycleBinItems({
	profiles,
	proxies,
	groups,
	rpaFlows,
}: DeletedRecycleBinCountInput): number {
	return (
		profiles.filter((item) => item.lifecycle === 'deleted').length +
		proxies.filter((item) => item.lifecycle === 'deleted').length +
		groups.filter((item) => item.lifecycle === 'deleted').length +
		getDeletedRpaFlows(rpaFlows).length
	);
}
