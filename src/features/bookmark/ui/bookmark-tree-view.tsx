import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Folder, FolderOpen, Globe, Lock } from 'lucide-react';

import type { BookmarkDisplayNode, BookmarkDisplayRoots } from '@/entities/bookmark/model/types';

type BookmarkTreeViewProps = {
	roots: BookmarkDisplayRoots;
	selectedId?: string;
	onSelect: (node: BookmarkDisplayNode) => void;
};

type TreeNodeProps = {
	node: BookmarkDisplayNode;
	depth: number;
	selectedId?: string;
	onSelect: (node: BookmarkDisplayNode) => void;
	expandedIds: Set<string>;
	onToggleExpand: (id: string) => void;
};

function TreeNode({ node, depth, selectedId, onSelect, expandedIds, onToggleExpand }: TreeNodeProps) {
	const isFolder = node.type === 'folder';
	const isExpanded = expandedIds.has(node.id);
	const isSelected = selectedId === node.id;
	const hasChildren = isFolder && node.children && node.children.length > 0;

	return (
		<div>
			<button
				type="button"
				onClick={() => {
					onSelect(node);
					if (isFolder && hasChildren) onToggleExpand(node.id);
				}}
				className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors cursor-pointer ${
					isSelected
						? 'bg-primary/10 text-primary'
						: 'hover:bg-muted/60 text-foreground'
				}`}
				style={{ paddingLeft: `${4 + depth * 14}px` }}
			>
				{isFolder ? (
					<span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
						{hasChildren ? (
							<ChevronRight
								className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
							/>
						) : (
							<span className="w-3" />
						)}
					</span>
				) : (
					<span className="h-3.5 w-3.5 shrink-0" />
				)}

				{isFolder ? (
					isExpanded ? (
						<FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
					) : (
						<Folder className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
					)
				) : (
					<Globe className="h-3.5 w-3.5 shrink-0 text-blue-400" />
				)}

				<span className="min-w-0 flex-1 truncate">{node.title}</span>

				{node.managed && (
					<Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
				)}
			</button>

			{isFolder && isExpanded && node.children && node.children.length > 0 && (
				<div>
					{node.children.map((child) => (
						<TreeNode
							key={child.id}
							node={child}
							depth={depth + 1}
							selectedId={selectedId}
							onSelect={onSelect}
							expandedIds={expandedIds}
							onToggleExpand={onToggleExpand}
						/>
					))}
				</div>
			)}
		</div>
	);
}

type SectionProps = {
	label: string;
	nodes: BookmarkDisplayNode[];
	selectedId?: string;
	onSelect: (node: BookmarkDisplayNode) => void;
	expandedIds: Set<string>;
	onToggleExpand: (id: string) => void;
};

function TreeSection({ label, nodes, selectedId, onSelect, expandedIds, onToggleExpand }: SectionProps) {
	const { t } = useTranslation('bookmark');
	if (nodes.length === 0) return null;

	return (
		<div>
			<div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</div>
			{nodes.length === 0 ? (
				<p className="px-2 py-1 text-xs text-muted-foreground">{t('tree.empty')}</p>
			) : (
				nodes.map((node) => (
					<TreeNode
						key={node.id}
						node={node}
						depth={0}
						selectedId={selectedId}
						onSelect={onSelect}
						expandedIds={expandedIds}
						onToggleExpand={onToggleExpand}
					/>
				))
			)}
		</div>
	);
}

export function BookmarkTreeView({ roots, selectedId, onSelect }: BookmarkTreeViewProps) {
	const { t } = useTranslation('bookmark');
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const totalCount =
		roots.bookmarkBar.length + roots.other.length + roots.mobile.length;

	if (totalCount === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-xs text-muted-foreground">{t('tree.empty')}</p>
			</div>
		);
	}

	return (
		<div className="overflow-y-auto h-full select-none">
			<TreeSection
				label={t('tree.bookmarkBar')}
				nodes={roots.bookmarkBar}
				selectedId={selectedId}
				onSelect={onSelect}
				expandedIds={expandedIds}
				onToggleExpand={toggleExpand}
			/>
			<TreeSection
				label={t('tree.other')}
				nodes={roots.other}
				selectedId={selectedId}
				onSelect={onSelect}
				expandedIds={expandedIds}
				onToggleExpand={toggleExpand}
			/>
			<TreeSection
				label={t('tree.mobile')}
				nodes={roots.mobile}
				selectedId={selectedId}
				onSelect={onSelect}
				expandedIds={expandedIds}
				onToggleExpand={toggleExpand}
			/>
		</div>
	);
}
