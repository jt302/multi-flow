import { useEffect, useState } from 'react';

import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
	AiConfigEntry,
	AutomationScript,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDefaultAiConfigQuery } from '@/entities/ai/model/use-default-ai-config-query';

type Props = {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	/** null = 新建模式，有值 = 编辑模式 */
	script: AutomationScript | null;
	allProfiles: ProfileItem[];
	aiConfigs: AiConfigEntry[];
	/** 所有已存在的脚本名称，用于重复检测 */
	existingNames: string[];
	onSave: (data: {
		name: string;
		description: string;
		associatedProfileIds: string[];
		aiConfigId: string | null;
	}) => void;
	isSaving: boolean;
};

/** 脚本元数据新建/编辑对话框 */
export function ScriptMetaDialog({
	open,
	onOpenChange,
	script,
	allProfiles,
	aiConfigs,
	existingNames,
	onSave,
	isSaving,
}: Props) {
	const [name, setName] = useState('');
	const [desc, setDesc] = useState('');
	const [associatedIds, setAssociatedIds] = useState<string[]>([]);
	const [aiConfigId, setAiConfigId] = useState<string | null>(null);
	const [profilePickerOpen, setProfilePickerOpen] = useState(false);
	const { t } = useTranslation(['automation', 'common']);

	const defaultConfigQuery = useDefaultAiConfigQuery();
	const defaultConfigId = defaultConfigQuery.data ?? null;
	const defaultConfig = defaultConfigId
		? (aiConfigs.find((c) => c.id === defaultConfigId) ?? null)
		: null;

	// 每次对话框打开时同步脚本数据
	useEffect(() => {
		if (open) {
			setName(script?.name ?? '');
			setDesc(script?.description ?? '');
			setAssociatedIds(script?.associatedProfileIds ?? []);
			setAiConfigId(script?.aiConfigId ?? null);
			setProfilePickerOpen(false);
		}
	}, [open, script]);

	const associatedProfiles = associatedIds
		.map((id) => allProfiles.find((p) => p.id === id))
		.filter((p): p is ProfileItem => p !== undefined);

	const availableProfiles = allProfiles.filter(
		(p) => !associatedIds.includes(p.id),
	);

	function bindProfile(profileId: string) {
		setAssociatedIds((prev) =>
			prev.includes(profileId) ? prev : [...prev, profileId],
		);
		setProfilePickerOpen(false);
	}

	function unbindProfile(profileId: string) {
		setAssociatedIds((prev) => prev.filter((id) => id !== profileId));
	}

	const trimmedName = name.trim();
	const isDuplicate =
		trimmedName !== '' &&
		existingNames.some(
			(n) =>
				n.toLowerCase() === trimmedName.toLowerCase() &&
				n.toLowerCase() !== (script?.name ?? '').toLowerCase(),
		);

	function handleSave() {
		if (!trimmedName || isDuplicate) return;
		onSave({
			name: trimmedName,
			description: desc,
			associatedProfileIds: associatedIds,
			aiConfigId,
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0">
				<DialogHeader className="shrink-0 pb-4">
					<DialogTitle>
						{script ? t('meta.editTitle') : t('meta.createTitle')}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-3 overflow-y-auto flex-1 min-h-0 p-1">
					{/* 脚本名称 */}
					<div className="space-y-1.5">
						<Label>{t('meta.scriptName')}</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t('meta.scriptNamePlaceholder')}
							onKeyDown={(e) => e.key === 'Enter' && handleSave()}
							autoFocus
							className={isDuplicate ? 'border-destructive' : ''}
						/>
						{isDuplicate && (
							<p className="text-xs text-destructive">
								{t('meta.nameDuplicate')}
							</p>
						)}
					</div>

					{/* 描述 */}
					<div className="space-y-1.5">
						<Label>{t('meta.descriptionOptional')}</Label>
						<Textarea
							value={desc}
							onChange={(e) => setDesc(e.target.value)}
							placeholder={t('meta.descriptionPlaceholder')}
							rows={2}
							className="resize-none"
						/>
					</div>

					{/* 关联环境 */}
					{allProfiles.length > 0 && (
						<div className="space-y-1.5">
							<Label className="text-sm">{t('meta.linkedProfiles')}</Label>
							<p className="text-xs text-muted-foreground">
								{t('meta.linkedProfilesDesc')}
							</p>
							<div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
								<div className="flex flex-wrap gap-2">
									{associatedProfiles.length > 0 ? (
										associatedProfiles.map((profile) => (
											<Badge
												key={profile.id}
												variant="secondary"
												className="flex items-center gap-1 pr-1"
											>
												<span className="max-w-45 truncate">
													{profile.name}
												</span>
												<button
													type="button"
													onClick={() => unbindProfile(profile.id)}
													className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
													aria-label={t('meta.removeProfile', {
														name: profile.name,
													})}
												>
													<X className="h-3 w-3" />
												</button>
											</Badge>
										))
									) : (
										<p className="text-xs text-muted-foreground px-1 py-1">
											{t('meta.noLinkedProfiles')}
										</p>
									)}
								</div>
								<Popover
									open={profilePickerOpen}
									onOpenChange={setProfilePickerOpen}
								>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="cursor-pointer"
											disabled={availableProfiles.length === 0}
										>
											<Plus className="h-3.5 w-3.5 mr-1" />
											{t('meta.addProfile')}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-70 p-0" align="start">
										<Command>
											<CommandInput placeholder={t('meta.searchProfile')} />
											<CommandList>
												<CommandEmpty>
													{t('meta.noBindableProfiles')}
												</CommandEmpty>
												{availableProfiles.map((profile) => (
													<CommandItem
														key={profile.id}
														onSelect={() => bindProfile(profile.id)}
													>
														{profile.name}
													</CommandItem>
												))}
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</div>
						</div>
					)}

					{/* AI 配置 */}
					<div className="space-y-1.5">
						<Label className="text-sm">{t('meta.aiConfigOptional')}</Label>
						<p className="text-xs text-muted-foreground">
							{aiConfigs.length > 0
								? t('meta.aiConfigHintWithConfigs')
								: t('meta.aiConfigHintNoConfigs')}
						</p>
						<Select
							value={aiConfigId ?? '__none__'}
							onValueChange={(v) => setAiConfigId(v === '__none__' ? null : v)}
							disabled={aiConfigs.length === 0}
						>
							<SelectTrigger className="h-9 text-sm cursor-pointer disabled:cursor-not-allowed">
								<SelectValue
									placeholder={
										aiConfigs.length > 0
											? t('meta.useGlobalConfig')
											: t('meta.addAiConfigFirst')
									}
								>
									{aiConfigId
										? (aiConfigs.find((c) => c.id === aiConfigId)?.name ?? aiConfigId)
										: (defaultConfig
											? `${t('meta.globalConfig', '全局配置')}(${defaultConfig.name})`
											: t('meta.useGlobalConfig'))}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__" className="cursor-pointer">
									{defaultConfig
										? `${t('meta.globalConfig', '全局配置')}(${defaultConfig.name})`
										: t('meta.useGlobalConfig')}
								</SelectItem>
								{aiConfigs.map((c) => (
									<SelectItem
										key={c.id}
										value={c.id}
										className="cursor-pointer"
									>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter className="shrink-0 pt-4">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="cursor-pointer"
					>
						{t('common:cancel')}
					</Button>
					<Button
						onClick={handleSave}
						disabled={!trimmedName || isDuplicate || isSaving}
						className="cursor-pointer"
					>
						{script ? t('common:save') : t('meta.createAndOpen')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
