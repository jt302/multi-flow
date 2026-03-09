import { toast } from 'sonner';

import {
	createGroup as createGroupApi,
	deleteGroup as deleteGroupApi,
	purgeGroup as purgeGroupApi,
	restoreGroup as restoreGroupApi,
	updateGroup as updateGroupApi,
} from '@/entities/group/api/groups-api';

type GroupActionsDeps = {
	refreshGroups: () => Promise<void>;
	refreshProfiles: () => Promise<void>;
};

export function useGroupActions({ refreshGroups, refreshProfiles }: GroupActionsDeps) {
	const createGroup = async (name: string, note: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}
		try {
			await createGroupApi(trimmedName, note);
			await refreshGroups();
			toast.success('分组已创建');
		} catch (error) {
			toast.error('创建分组失败');
			throw error;
		}
	};

	const updateGroup = async (groupId: string, name: string, note: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}
		try {
			await updateGroupApi(groupId, trimmedName, note);
			await Promise.all([refreshGroups(), refreshProfiles()]);
			toast.success('分组已更新');
		} catch (error) {
			toast.error('更新分组失败');
			throw error;
		}
	};

	const deleteGroup = async (id: string) => {
		try {
			await deleteGroupApi(id);
			await Promise.all([refreshGroups(), refreshProfiles()]);
			toast.success('分组已删除');
		} catch (error) {
			toast.error('删除分组失败');
			throw error;
		}
	};

	const restoreGroup = async (id: string) => {
		try {
			await restoreGroupApi(id);
			await refreshGroups();
			toast.success('分组已恢复');
		} catch (error) {
			toast.error('恢复分组失败');
			throw error;
		}
	};

	const purgeGroup = async (id: string) => {
		try {
			await purgeGroupApi(id);
			await refreshGroups();
			toast.success('分组已彻底删除');
		} catch (error) {
			toast.error('彻底删除分组失败');
			throw error;
		}
	};

	return {
		createGroup,
		updateGroup,
		deleteGroup,
		restoreGroup,
		purgeGroup,
	};
}
