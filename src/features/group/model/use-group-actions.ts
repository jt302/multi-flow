import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	createGroup as createGroupApi,
	deleteGroup as deleteGroupApi,
	purgeGroup as purgeGroupApi,
	restoreGroup as restoreGroupApi,
	updateGroup as updateGroupApi,
} from '@/entities/group/api/groups-api';
import type { ToolbarLabelMode } from '@/entities/profile/model/types';

type GroupActionsDeps = {
	refreshGroups: () => Promise<void>;
	refreshProfiles: () => Promise<void>;
};

export function useGroupActions({ refreshGroups, refreshProfiles }: GroupActionsDeps) {
	const { t } = useTranslation('group');
	const createGroup = async (
		name: string,
		note: string,
		options: { browserBgColor?: string | null; toolbarLabelMode: ToolbarLabelMode },
	) => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}
		try {
			await createGroupApi(trimmedName, note, options);
			await refreshGroups();
			toast.success(t('actions.created'));
		} catch (error) {
			toast.error(t('actions.createFailed'));
			throw error;
		}
	};

	const updateGroup = async (
		groupId: string,
		name: string,
		note: string,
		options: { browserBgColor?: string | null; toolbarLabelMode: ToolbarLabelMode },
	) => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}
		try {
			await updateGroupApi(groupId, trimmedName, note, options);
			await Promise.all([refreshGroups(), refreshProfiles()]);
			toast.success(t('actions.updated'));
		} catch (error) {
			toast.error(t('actions.updateFailed'));
			throw error;
		}
	};

	const deleteGroup = async (id: string) => {
		try {
			await deleteGroupApi(id);
			await Promise.all([refreshGroups(), refreshProfiles()]);
			toast.success(t('actions.deleted'));
		} catch (error) {
			toast.error(t('actions.deleteFailed'));
			throw error;
		}
	};

	const restoreGroup = async (id: string) => {
		try {
			await restoreGroupApi(id);
			await refreshGroups();
			toast.success(t('actions.restored'));
		} catch (error) {
			toast.error(t('actions.restoreFailed'));
			throw error;
		}
	};

	const purgeGroup = async (id: string) => {
		try {
			await purgeGroupApi(id);
			await refreshGroups();
			toast.success(t('actions.permanentlyDeleted'));
		} catch (error) {
			toast.error(t('actions.permanentDeleteFailed'));
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
