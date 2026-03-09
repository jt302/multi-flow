import { toast } from 'sonner';

import {
	createGroup as createGroupApi,
	deleteGroup as deleteGroupApi,
	restoreGroup as restoreGroupApi,
} from '@/entities/group/api/groups-api';

type GroupActionsDeps = {
	refreshGroups: () => Promise<void>;
};

export function useGroupActions({ refreshGroups }: GroupActionsDeps) {
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

	const deleteGroup = async (id: string) => {
		try {
			await deleteGroupApi(id);
			await refreshGroups();
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

	return {
		createGroup,
		deleteGroup,
		restoreGroup,
	};
}
