import type { ToolbarLabelMode } from '@/entities/profile/model/types';

export type GroupItem = {
	id: string;
	name: string;
	note: string;
	browserBgColor?: string | null;
	toolbarLabelMode: ToolbarLabelMode;
	profileCount: number;
	rawUpdatedAt?: number;
	updatedAt: string;
	lifecycle: 'active' | 'deleted';
	deletedAt?: number | null;
};
