import type { GroupItem } from '@/entities/group/model/types';
import type { ToolbarLabelMode } from '@/entities/profile/model/types';

export type GroupsPageProps = {
	groups: GroupItem[];
	onCreateGroup: (
		name: string,
		note: string,
		options: { browserBgColor?: string | null; toolbarLabelMode: ToolbarLabelMode },
	) => Promise<void> | void;
	onUpdateGroup: (
		groupId: string,
		name: string,
		note: string,
		options: { browserBgColor?: string | null; toolbarLabelMode: ToolbarLabelMode },
	) => Promise<void> | void;
	onDeleteGroup: (id: string) => Promise<void> | void;
	onOpenGroupProfiles: (groupName: string) => void;
};

export type GroupFormMode = 'create' | 'edit';
