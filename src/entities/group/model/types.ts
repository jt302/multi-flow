export type GroupItem = {
	id: string;
	name: string;
	note: string;
	profileCount: number;
	rawUpdatedAt?: number;
	updatedAt: string;
	lifecycle: 'active' | 'deleted';
	deletedAt?: number | null;
};
