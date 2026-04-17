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

export function resolveNextExpandedNavId(
	current: ExpandableWorkspaceNavId | null,
	next: ExpandableWorkspaceNavId,
): ExpandableWorkspaceNavId | null {
	return current === next ? null : next;
}
