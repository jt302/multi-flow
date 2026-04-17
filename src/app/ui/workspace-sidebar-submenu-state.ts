import type { NavId, NavItem } from '@/app/model/workspace-types';

export type ExpandableWorkspaceNavId = NavId;

export type ExpandableNavItem = NavItem & {
	children: NonNullable<NavItem['children']>;
};

export function isExpandableNavItem(item: NavItem): item is ExpandableNavItem {
	return Array.isArray(item.children) && item.children.length > 0;
}

export function findAutoExpandedNavId(
	items: NavItem[],
	activePath: string,
): ExpandableWorkspaceNavId | null {
	for (const item of items) {
		if (!isExpandableNavItem(item)) {
			continue;
		}

		if (item.children.some((child) => child.path === activePath)) {
			return item.id;
		}
	}

	return null;
}

export function resolveNextExpandedNavIds(
	current: ExpandableWorkspaceNavId[],
	next: ExpandableWorkspaceNavId,
): ExpandableWorkspaceNavId[] {
	return current.includes(next)
		? current.filter((item) => item !== next)
		: [...current, next];
}

export function mergeExpandedNavIds(
	current: ExpandableWorkspaceNavId[],
	next: ExpandableWorkspaceNavId | null,
): ExpandableWorkspaceNavId[] {
	if (!next || current.includes(next)) {
		return current;
	}

	return [...current, next];
}
