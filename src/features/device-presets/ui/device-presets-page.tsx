import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Badge,
	Button,
	Card,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ScrollArea,
} from '@/components/ui';
import { getPlatformMeta } from '@/entities/profile/lib/platform-meta';
import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
import { PlatformGlyph } from '@/entities/profile/ui/platform-mark';
import { useDevicePresetEditor } from '@/features/device-presets/model/use-device-preset-editor';
import { DevicePresetForm } from '@/features/device-presets/ui/device-preset-form';

type DevicePresetsPageProps = {
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
		options?: { syncToProfiles?: boolean },
	) => Promise<void>;
	onDeleteDevicePreset: (presetId: string) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
};

type DevicePresetFormMode = 'create' | 'edit' | 'view';

export function DevicePresetsPage({
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onDeleteDevicePreset,
	onRefreshDevicePresets,
}: DevicePresetsPageProps) {
	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<DevicePresetFormMode>('create');
	const [deleteTarget, setDeleteTarget] = useState<ProfileDevicePresetItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const { t } = useTranslation(['device', 'common']);

	const { form, activePreset, copyPreset, setActivePresetId, resetPresetEditor, handleSavePreset } =
		useDevicePresetEditor({
			devicePresets,
			onCreateDevicePreset,
			onUpdateDevicePreset,
			onRefreshDevicePresets,
			t,
		});

	function openCreate() {
		resetPresetEditor();
		setFormMode('create');
		setFormOpen(true);
	}

	function openEdit(preset: ProfileDevicePresetItem) {
		setActivePresetId(preset.id);
		setFormMode('edit');
		setFormOpen(true);
	}

	function openView(preset: ProfileDevicePresetItem) {
		setActivePresetId(preset.id);
		setFormMode('view');
		setFormOpen(true);
	}

	function openCopy(preset: ProfileDevicePresetItem) {
		copyPreset(preset, t('form.copySuffix'));
		setFormMode('create');
		setFormOpen(true);
	}

	function copyActivePreset() {
		if (!activePreset) return;
		openCopy(activePreset);
	}

	function handleFormReset() {
		resetPresetEditor();
		setFormMode('create');
		setFormOpen(false);
	}

	async function handleFormSubmit() {
		if (formMode === 'view') {
			return;
		}
		await handleSavePreset({ syncToProfiles: formMode === 'edit' })();
		setFormOpen(false);
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await onDeleteDevicePreset(deleteTarget.id);
		} finally {
			setDeleting(false);
			setDeleteTarget(null);
		}
	}

	return (
		<div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">{t('page.title')}</h2>
					<p className="text-sm text-muted-foreground mt-0.5">{t('page.desc')}</p>
				</div>
				<Button type="button" onClick={openCreate} className="cursor-pointer">
					<Plus className="h-4 w-4 mr-1.5" />
					{t('page.addPreset')}
				</Button>
			</div>

			{/* List */}
			<Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
				{devicePresets.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<p className="text-sm">{t('page.empty')}</p>
						<p className="text-xs mt-1">{t('page.emptyHint')}</p>
					</div>
				) : (
					<ScrollArea className="max-h-[calc(100vh-280px)]">
						<div className="divide-y divide-border/40">
							{devicePresets.map((preset) => (
								<div
									key={preset.id}
									className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
								>
									<div className="min-w-0 flex-1 flex items-center gap-3">
										<PlatformGlyph
											meta={getPlatformMeta(preset.platform)}
											size="lg"
											className="!h-6 !w-6"
										/>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="text-sm font-medium truncate">{preset.label}</p>
												<Badge variant="outline" className="text-xs flex-shrink-0">
													{preset.formFactor}
												</Badge>
												<Badge variant="secondary" className="text-xs flex-shrink-0">
													Chrome {preset.browserVersion}
												</Badge>
												{preset.mobile && preset.formFactor.trim().toLowerCase() !== 'mobile' && (
													<Badge variant="secondary" className="text-xs flex-shrink-0">
														{t('common:mobile')}
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground mt-0.5">
												{preset.platform} · {preset.viewportWidth}×{preset.viewportHeight} · DPR{' '}
												{preset.deviceScaleFactor} · {preset.arch} {preset.bitness}-bit
											</p>
										</div>
									</div>

									<div className="flex items-center gap-1 flex-shrink-0 ml-2">
										{!preset.isBuiltin ? (
											<>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="cursor-pointer"
													onClick={() => openEdit(preset)}
													aria-label={t('page.editPreset')}
													title={t('page.editPreset')}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="cursor-pointer"
													onClick={() => openCopy(preset)}
													aria-label={t('page.copyPreset')}
													title={t('page.copyPreset')}
												>
													<Copy className="h-3.5 w-3.5" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="cursor-pointer text-destructive hover:text-destructive"
													onClick={() => setDeleteTarget(preset)}
													aria-label={t('page.deleteTitle')}
													title={t('page.deleteTitle')}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</>
										) : (
											<>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="cursor-pointer"
													onClick={() => openView(preset)}
													aria-label={t('page.viewPreset')}
													title={t('page.viewPreset')}
												>
													<Eye className="h-3.5 w-3.5" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="cursor-pointer"
													onClick={() => openCopy(preset)}
													aria-label={t('page.copyPreset')}
													title={t('page.copyPreset')}
												>
													<Copy className="h-3.5 w-3.5" />
												</Button>
											</>
										)}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				)}
			</Card>

			{/* Edit / Create Dialog */}
			<Dialog
				open={formOpen}
				onOpenChange={(v) => {
					if (!v) handleFormReset();
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{formMode === 'view'
								? t('page.viewPreset')
								: formMode === 'edit'
									? t('page.editPreset')
									: t('page.addPreset')}
						</DialogTitle>
					</DialogHeader>
					<DevicePresetForm
						form={form}
						activePreset={activePreset}
						readonly={formMode === 'view'}
						onReset={handleFormReset}
						onCopy={copyActivePreset}
						onSubmit={() => {
							void handleFormSubmit();
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Delete Confirm Dialog */}
			<Dialog
				open={Boolean(deleteTarget)}
				onOpenChange={(v) => {
					if (!v) setDeleteTarget(null);
				}}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>{t('page.deleteTitle')}</DialogTitle>
						<DialogDescription>
							{t('page.deleteDesc', { name: deleteTarget?.label })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setDeleteTarget(null)}
							className="cursor-pointer"
						>
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={deleting}
							onClick={() => {
								void confirmDelete();
							}}
							className="cursor-pointer"
						>
							{deleting ? t('common:deletingInProgress') : t('page.confirmDelete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
