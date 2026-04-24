import { Download, RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui';
import { exportProfileBookmarks } from '@/entities/bookmark/api/bookmark-api';
import type { BookmarkDisplayNode, BookmarkTemplateItem } from '@/entities/bookmark/model/types';
import { useBookmarkTemplatesQuery } from '@/entities/bookmark/model/use-bookmark-templates-query';
import { useProfileBookmarksQuery } from '@/entities/bookmark/model/use-profile-bookmarks-query';
import type { ProfileItem as ProfileItemType } from '@/entities/profile/model/types';
import { useBookmarkActions } from '@/features/bookmark/model/use-bookmark-actions';
import { useTemplateActions } from '@/features/bookmark/model/use-template-actions';
import { BookmarkDetailPanel } from '@/features/bookmark/ui/bookmark-detail-panel';
import {
	BookmarkExportDialog,
	BookmarkImportDialog,
} from '@/features/bookmark/ui/bookmark-import-export-dialog';
import { BookmarkTreeView } from '@/features/bookmark/ui/bookmark-tree-view';
import { TemplateEditor } from '@/features/bookmark/ui/template-editor';
import { TemplateList } from '@/features/bookmark/ui/template-list';

type BookmarkTabProps = {
	profiles: ProfileItemType[];
};

export function BookmarkTab({ profiles }: BookmarkTabProps) {
	const { t } = useTranslation('bookmark');

	// ── 环境书签 tab 状态 ──────────────────────────────────────────────────
	const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
		profiles.find((p) => p.running)?.id ?? profiles[0]?.id ?? null,
	);
	const [selectedNode, setSelectedNode] = useState<BookmarkDisplayNode | null>(null);
	const [showImport, setShowImport] = useState(false);
	const [showExport, setShowExport] = useState(false);
	const [exportContent, setExportContent] = useState('');

	const bookmarksQuery = useProfileBookmarksQuery(selectedProfileId);
	const actions = useBookmarkActions(selectedProfileId);

	// ── 模板 tab 状态 ──────────────────────────────────────────────────────
	const templatesQuery = useBookmarkTemplatesQuery();
	const templateActions = useTemplateActions();
	const [selectedTemplate, setSelectedTemplate] = useState<BookmarkTemplateItem | null>(null);

	const handleProfileChange = (id: string) => {
		setSelectedProfileId(id);
		setSelectedNode(null);
	};

	const handleRefresh = () => {
		void bookmarksQuery.refetch();
	};

	const handleExport = async () => {
		if (!selectedProfileId) return;
		try {
			const content = await exportProfileBookmarks(selectedProfileId);
			setExportContent(content);
			setShowExport(true);
		} catch {
			// silently fail
		}
	};

	const handleUpdate = (nodeId: string, title: string, url?: string) => {
		if (!selectedProfileId) return;
		actions.updateBookmark.mutate({ profileId: selectedProfileId, nodeId, title, url });
		setSelectedNode((prev) => (prev ? { ...prev, title, url } : null));
	};

	const handleRemove = (nodeId: string) => {
		actions.removeBookmark.mutate(nodeId);
		setSelectedNode(null);
	};

	// 新建模板：插入空白占位，让编辑器立刻可见
	const handleNewTemplate = () => {
		templateActions.createTemplate.mutate(
			{
				name: t('templates.new'),
				treeJson: '{}',
			},
			{
				onSuccess: (created) => {
					setSelectedTemplate(created);
				},
			},
		);
	};

	const handleDeleteTemplate = (id: number) => {
		templateActions.deleteTemplate.mutate(id, {
			onSuccess: () => {
				if (selectedTemplate?.id === id) setSelectedTemplate(null);
			},
		});
	};

	const isLive = bookmarksQuery.data?.isLive ?? false;
	const roots = bookmarksQuery.data?.roots ?? { bookmarkBar: [], other: [], mobile: [] };

	return (
		<Tabs defaultValue="profile" className="flex flex-col h-full min-h-0">
			<TabsList className="h-8 shrink-0 mx-0 rounded-none border-b border-border/60 bg-transparent justify-start px-2 gap-1">
				<TabsTrigger
					value="profile"
					className="text-xs h-7 px-3 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-none rounded-sm"
				>
					{t('tab.profileBookmarks')}
				</TabsTrigger>
				<TabsTrigger
					value="templates"
					className="text-xs h-7 px-3 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-none rounded-sm"
				>
					{t('tab.templates')}
				</TabsTrigger>
			</TabsList>

			{/* ── 环境书签 SubTab ─────────────────────────────────────────── */}
			<TabsContent value="profile" className="flex flex-col flex-1 min-h-0 mt-0 gap-2 pt-2">
				{/* Toolbar */}
				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					<Select value={selectedProfileId ?? ''} onValueChange={handleProfileChange}>
						<SelectTrigger className="h-8 text-xs w-[180px] cursor-pointer">
							<SelectValue placeholder={t('selector.placeholder')} />
						</SelectTrigger>
						<SelectContent>
							{profiles.length === 0 ? (
								<SelectItem value="_none" disabled className="text-xs">
									{t('selector.noProfiles')}
								</SelectItem>
							) : (
								profiles.map((p) => (
									<SelectItem key={p.id} value={p.id} className="text-xs cursor-pointer">
										<span className="flex items-center gap-1.5">
											<span
												className={`h-1.5 w-1.5 rounded-full shrink-0 ${
													p.running ? 'bg-green-500' : 'bg-muted-foreground/40'
												}`}
											/>
											{p.name}
										</span>
									</SelectItem>
								))
							)}
						</SelectContent>
					</Select>

					{bookmarksQuery.data && (
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
								isLive ? 'bg-green-500/10 text-green-600' : 'bg-muted/60 text-muted-foreground'
							}`}
						>
							<span
								className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-muted-foreground/50'}`}
							/>
							{isLive ? t('status.live') : t('status.snapshot')}
						</span>
					)}

					<div className="flex items-center gap-1 ml-auto">
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7 cursor-pointer"
							onClick={handleRefresh}
							disabled={bookmarksQuery.isFetching}
						>
							<RefreshCw
								className={`h-3.5 w-3.5 ${bookmarksQuery.isFetching ? 'animate-spin' : ''}`}
							/>
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7 cursor-pointer"
							onClick={() => setShowImport(true)}
							disabled={!selectedProfileId}
						>
							<Upload className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7 cursor-pointer"
							onClick={() => void handleExport()}
							disabled={!selectedProfileId}
						>
							<Download className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				{/* Main area */}
				<div className="flex flex-1 min-h-0 gap-2 overflow-hidden rounded-md border border-border/60">
					{/* Tree (left 60%) */}
					<div className="w-[60%] min-w-0 border-r border-border/60 overflow-hidden flex flex-col">
						{bookmarksQuery.isLoading ? (
							<div className="p-2 space-y-1">
								{Array.from({ length: 6 }).map((_, i) => (
									<Skeleton key={i} className="h-5 w-full" />
								))}
							</div>
						) : bookmarksQuery.isError ? (
							<div className="flex h-full items-center justify-center p-4">
								<p className="text-xs text-destructive">{t('errors.loadFailed')}</p>
							</div>
						) : !selectedProfileId ? (
							<div className="flex h-full items-center justify-center p-4">
								<p className="text-xs text-muted-foreground">{t('selector.placeholder')}</p>
							</div>
						) : (
							<BookmarkTreeView
								roots={roots}
								selectedId={selectedNode?.id}
								onSelect={setSelectedNode}
							/>
						)}
					</div>

					{/* Detail (right 40%) */}
					<div className="w-[40%] min-w-0 overflow-hidden">
						<BookmarkDetailPanel
							node={selectedNode}
							isLive={isLive}
							onUpdate={handleUpdate}
							onRemove={handleRemove}
							isPending={actions.updateBookmark.isPending || actions.removeBookmark.isPending}
						/>
					</div>
				</div>

				{/* Dialogs */}
				{showImport && selectedProfileId && (
					<BookmarkImportDialog
						open={showImport}
						onClose={() => setShowImport(false)}
						profileId={selectedProfileId}
						onImport={(req) => actions.importBookmarks.mutate(req)}
						isPending={actions.importBookmarks.isPending}
					/>
				)}
				{showExport && (
					<BookmarkExportDialog
						open={showExport}
						onClose={() => setShowExport(false)}
						content={exportContent}
					/>
				)}
			</TabsContent>

			{/* ── 书签模板 SubTab ──────────────────────────────────────────── */}
			<TabsContent value="templates" className="flex flex-1 min-h-0 mt-0 overflow-hidden">
				{/* 左侧模板列表（1/3 宽） */}
				<div className="w-1/3 min-w-0 border-r border-border/60 overflow-hidden">
					<TemplateList
						templates={templatesQuery.data ?? []}
						isLoading={templatesQuery.isLoading}
						selectedId={selectedTemplate?.id ?? null}
						onSelect={setSelectedTemplate}
						onNew={handleNewTemplate}
						onDelete={handleDeleteTemplate}
						isDeleting={templateActions.deleteTemplate.isPending}
					/>
				</div>

				{/* 右侧编辑器（2/3 宽） */}
				<div className="flex-1 min-w-0 overflow-hidden">
					{selectedTemplate ? (
						<TemplateEditor
							key={selectedTemplate.id}
							template={selectedTemplate}
							profiles={profiles}
							onUpdate={(req) =>
								templateActions.updateTemplate.mutate(req, {
									onSuccess: (updated) => setSelectedTemplate(updated),
								})
							}
							isUpdating={templateActions.updateTemplate.isPending}
							onApply={(req) => templateActions.applyTemplate.mutate(req)}
							isApplying={templateActions.applyTemplate.isPending}
							applyResult={templateActions.applyResult}
							onClearApplyResult={templateActions.clearApplyResult}
						/>
					) : (
						<div className="flex h-full items-center justify-center p-6 text-center">
							<p className="text-xs text-muted-foreground">{t('templates.noTemplates')}</p>
						</div>
					)}
				</div>
			</TabsContent>
		</Tabs>
	);
}
