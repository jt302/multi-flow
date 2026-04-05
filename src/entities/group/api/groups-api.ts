import i18next from 'i18next';

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

function formatTimeAgo(unixTs: number): string {
	const now = Math.floor(Date.now() / 1000);
	const diff = Math.max(0, now - unixTs);
	if (diff < 60) {
		return i18next.t('common:justNow');
	}
	if (diff < 3600) {
		return i18next.t('common:minutesAgo', { count: Math.floor(diff / 60) });
	}
	if (diff < 86400) {
		return i18next.t('common:hoursAgo', { count: Math.floor(diff / 3600) });
	}
	return i18next.t('common:daysAgo', { count: Math.floor(diff / 86400) });
}

function mapBackendGroup(item: BackendGroup): GroupItem {
	return {
		id: item.id,
		name: item.name,
		note: item.note ?? i18next.t('group:mock.noNote'),
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
		return [];
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

export async function purgeGroup(groupId: string): Promise<void> {
	await tauriInvoke('purge_profile_group', { groupId });
}
