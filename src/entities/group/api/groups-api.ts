import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type { GroupItem } from '@/entities/group/model/types';

type GroupLifecycle = 'active' | 'deleted';

type BackendGroup = {
	id: string;
	name: string;
	note: string | null;
	lifecycle: GroupLifecycle;
	profileCount: number;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
};

type ListGroupsResponse = {
	items: BackendGroup[];
	total: number;
};

const DEFAULT_GROUPS: GroupItem[] = [
	{
		id: 'g_airdrop',
		name: 'AirDrop',
		note: '空投批量任务',
		profileCount: 12,
		updatedAt: '刚刚',
		lifecycle: 'active',
		deletedAt: null,
	},
	{
		id: 'g_farm',
		name: 'Farm',
		note: '收益农场矩阵',
		profileCount: 8,
		updatedAt: '8 分钟前',
		lifecycle: 'active',
		deletedAt: null,
	},
	{
		id: 'g_brand',
		name: 'Brand',
		note: '品牌账号运营',
		profileCount: 5,
		updatedAt: '20 分钟前',
		lifecycle: 'active',
		deletedAt: null,
	},
];

function formatTimeAgo(unixTs: number): string {
	const now = Math.floor(Date.now() / 1000);
	const diff = Math.max(0, now - unixTs);
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

function mapBackendGroup(item: BackendGroup): GroupItem {
	return {
		id: item.id,
		name: item.name,
		note: item.note ?? '未填写备注',
		profileCount: item.profileCount,
		rawUpdatedAt: item.updatedAt,
		updatedAt: formatTimeAgo(item.updatedAt),
		lifecycle: item.lifecycle,
		deletedAt: item.deletedAt,
	};
}

export async function listGroups(includeDeleted = false): Promise<GroupItem[]> {
	try {
		const result = await tauriInvoke<ListGroupsResponse>('list_profile_groups', {
			includeDeleted,
		});
		return result.items.map(mapBackendGroup);
	} catch {
		return includeDeleted ? DEFAULT_GROUPS : DEFAULT_GROUPS.filter((item) => item.lifecycle === 'active');
	}
}

export async function createGroup(name: string, note: string): Promise<void> {
	await tauriInvoke('create_profile_group', {
		payload: {
			name,
			note: note.trim() ? note : null,
		},
	});
}

export async function updateGroup(groupId: string, name: string, note: string): Promise<void> {
	await tauriInvoke('update_profile_group', {
		groupId,
		payload: {
			name,
			note: note.trim() ? note : null,
		},
	});
}

export async function deleteGroup(groupId: string): Promise<void> {
	await tauriInvoke('delete_profile_group', { groupId });
}

export async function restoreGroup(groupId: string): Promise<void> {
	await tauriInvoke('restore_profile_group', { groupId });
}
