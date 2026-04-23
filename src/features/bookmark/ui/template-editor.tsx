import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';

import {
	useBookmarkTemplatesQuery,
	useTemplateSubscriptionsQuery,
} from '@/entities/bookmark/model/use-bookmark-templates-query';
import type {
	BookmarkTemplateItem,
	UpdateBookmarkTemplateRequest,
} from '@/entities/bookmark/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Input,
	Label,
	Separator,
	Textarea,
} from '@/components/ui';
import type {
	ApplyBookmarkTemplateRequest,
	BatchProfileActionResponse,
} from '@/entities/bookmark/model/types';
import { ApplyTemplateDialog } from './apply-template-dialog';

type TemplateEditorProps = {
	template: BookmarkTemplateItem;
	profiles: ProfileItem[];
	onUpdate: (req: UpdateBookmarkTemplateRequest) => void;
	isUpdating: boolean;
	onApply: (req: ApplyBookmarkTemplateRequest) => void;
	isApplying: boolean;
	applyResult: BatchProfileActionResponse | null;
	onClearApplyResult: () => void;
};

export function TemplateEditor({
	template,
	profiles,
	onUpdate,
	isUpdating,
	onApply,
	isApplying,
	applyResult,
	onClearApplyResult,
}: TemplateEditorProps) {
	const { t } = useTranslation('bookmark');

	// 本地表单状态
	const [name, setName] = useState(template.name);
	const [description, setDescription] = useState(template.description ?? '');
	const [tags, setTags] = useState(template.tags ?? '');
	const [treeJson, setTreeJson] = useState(template.treeJson);

	// 同步外部 template 变更（切换模板时）
	useEffect(() => {
		setName(template.name);
		setDescription(template.description ?? '');
		setTags(template.tags ?? '');
		setTreeJson(template.treeJson);
	}, [template.id, template.name, template.description, template.tags, template.treeJson]);

	// 查询模板订阅数量
	const subscriptionsQuery = useTemplateSubscriptionsQuery(template.id);
	const subscriptions = subscriptionsQuery.data ?? [];
	const autoSubs = subscriptions.filter((s) => s.syncMode === 'auto');

	const [showSyncConfirm, setShowSyncConfirm] = useState(false);
	const [showApplyDialog, setShowApplyDialog] = useState(false);

	// 保存时：如果有 auto 订阅者，弹确认框询问是否立即同步
	const handleSave = () => {
		const req: UpdateBookmarkTemplateRequest = {
			id: template.id,
			name: name || undefined,
			description: description || undefined,
			tags: tags || undefined,
			treeJson: treeJson || undefined,
		};
		if (autoSubs.length > 0) {
			// 先保存，再询问是否同步
			onUpdate(req);
			setShowSyncConfirm(true);
		} else {
			onUpdate(req);
		}
	};

	const handleSyncNow = () => {
		setShowSyncConfirm(false);
		// 立即下发到所有 auto 订阅的 profiles
		onApply({
			templateId: template.id,
			profileIds: autoSubs.map((s) => s.profileId),
			strategy: 'mount_as_folder',
		});
	};

	const isDirty =
		name !== template.name ||
		description !== (template.description ?? '') ||
		tags !== (template.tags ?? '') ||
		treeJson !== template.treeJson;

	// 查询键（仅用于 refetch after update）
	useBookmarkTemplatesQuery();

	return (
		<div className="flex flex-col h-full min-h-0 gap-3 p-3 overflow-y-auto">
			{/* 基本信息 */}
			<div className="space-y-3">
				<div className="space-y-1.5">
					<Label className="text-xs">{t('templates.name')}</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="h-8 text-xs"
						placeholder={t('templates.namePlaceholder')}
					/>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1.5">
						<Label className="text-xs">{t('templates.description')}</Label>
						<Input
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="h-8 text-xs"
							placeholder={t('templates.descPlaceholder')}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">{t('templates.tags')}</Label>
						<Input
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							className="h-8 text-xs"
							placeholder={t('templates.tagsPlaceholder')}
						/>
					</div>
				</div>
			</div>

			{/* 版本 + 订阅者统计 */}
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<span>
					{t('templates.version')} <strong>v{template.version}</strong>
				</span>
				{subscriptions.length > 0 && (
					<span>{t('templates.subscribers', { count: subscriptions.length })}</span>
				)}
			</div>

			<Separator />

			{/* 书签 JSON 编辑区 */}
			<div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
				<Label className="text-xs">{t('templates.treeJson')}</Label>
				<Textarea
					value={treeJson}
					onChange={(e) => setTreeJson(e.target.value)}
					className="font-mono text-xs flex-1 min-h-[160px] resize-none"
					placeholder="{}"
				/>
			</div>

			{/* 操作按钮 */}
			<div className="flex items-center gap-2 shrink-0">
				<Button
					size="sm"
					className="cursor-pointer"
					disabled={!isDirty || isUpdating}
					onClick={handleSave}
				>
					{isUpdating ? '...' : t('detail.save')}
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="cursor-pointer ml-auto"
					onClick={() => setShowApplyDialog(true)}
				>
					<Send className="h-3 w-3 mr-1.5" />
					{t('templates.apply')}
				</Button>
			</div>

			{/* 自动同步确认弹窗 */}
			<AlertDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('templates.syncConfirmTitle')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('templates.syncConfirmMsg', { count: autoSubs.length })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							className="cursor-pointer"
							onClick={() => setShowSyncConfirm(false)}
						>
							{t('templates.skipSync')}
						</AlertDialogCancel>
						<AlertDialogAction className="cursor-pointer" onClick={handleSyncNow}>
							{t('templates.syncNow')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 下发对话框 */}
			{showApplyDialog && (
				<ApplyTemplateDialog
					open={showApplyDialog}
					template={template}
					profiles={profiles}
					onClose={() => setShowApplyDialog(false)}
					onApply={onApply}
					isPending={isApplying}
					result={applyResult}
					onClearResult={onClearApplyResult}
				/>
			)}
		</div>
	);
}
