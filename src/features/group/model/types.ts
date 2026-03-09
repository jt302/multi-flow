import type { GroupItem } from '@/entities/group/model/types';

export type GroupsPageProps = {
	groups: GroupItem[];
	onCreateGroup: (name: string, note: string) => Promise<void> | void;
	onDeleteGroup: (id: string) => Promise<void> | void;
};
