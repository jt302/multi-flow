import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { getPlatformMeta } from '@/entities/profile/lib/platform-meta';
import { PlatformGlyph } from '@/entities/profile/ui/platform-mark';
import { useTranslation } from 'react-i18next';

import {
	Badge,
	Button,
	Card,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Label,
	ScrollArea,
} from '@/components/ui';
import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
import { useDevicePresetRefCountQuery } from '@/entities/profile/model/use-device-preset-ref-count-query';
import { useDevicePresetEditor } from '@/features/device-presets/model/use-device-preset-editor';
import { DevicePresetForm } from '@/features/device-presets/ui/device-preset-form';

type DevicePresetsPageProps = {
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (
		payload: SaveProfileDevicePresetPayload,
	) => Promise<void>;
	onUpdateDevicePreset: (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
		options?: { syncToProfiles?: boolean },
	) => Promise<void>;
	onDeleteDevicePreset: (presetId: string) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
};

export function DevicePresetsPage({
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onDeleteDevicePreset,
	onRefreshDevicePresets,
}: DevicePresetsPageProps) {
	const [formOpen, setFormOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] =
		useState<ProfileDevicePresetItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
	const [syncChecked, setSyncChecked] = useState(true);
	const [saving, setSaving] = useState(false);
	const { t } = useTranslation(['device', 'common']);

	const {
		form,
		activePreset,
		setActivePresetId,
		resetPresetEditor,
		handleSavePreset,
	} = useDevicePresetEditor({
		devicePresets,
		onCreateDevicePreset,
		onUpdateDevicePreset,
		onRefreshDevicePresets,
		t,
	});

	const { data: refCount = 0 } = useDevicePresetRefCountQuery(activePreset?.id);

	function openCreate() {
		resetPresetEditor();
		setFormOpen(true);
	}

	function openEdit(preset: ProfileDevicePresetItem) {
		setActivePresetId(preset.id);
		setFormOpen(true);
	}

	function handleFormReset() {
		resetPresetEditor();
		setFormOpen(false);
	}

	async function handleFormSubmit() {
		if (activePreset && refCount > 0) {
			setSyncChecked(true);
			setSyncConfirmOpen(true);
			return;
		}
		await handleSavePreset()();
		setFormOpen(false);
	}

	async function handleSyncConfirm() {
		setSaving(true);
		try {
			await handleSavePreset({ syncToProfiles: syncChecked })();
			setSyncConfirmOpen(false);
			setFormOpen(false);
		} finally {
			setSaving(false);
		}
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
					<p className="text-sm text-muted-foreground mt-0.5">
						{t('page.desc')}
					</p>
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
											<p className="text-sm font-medium truncate">
												{preset.label}
											</p>
											<Badge
												variant="outline"
												className="text-xs flex-shrink-0"
											>
												{preset.formFactor}
											</Badge>
											{preset.mobile &&
												preset.formFactor.trim().toLowerCase() !== 'mobile' && (
													<Badge
														variant="secondary"
														className="text-xs flex-shrink-0"
													>
														{t('common:mobile')}
													</Badge>
												)}
										</div>
										<p className="text-xs text-muted-foreground mt-0.5">
											{preset.platform} · {preset.viewportWidth}×
											{preset.viewportHeight} · DPR {preset.deviceScaleFactor} ·{' '}
											{preset.arch} {preset.bitness}-bit
										</p>
									</div>
									</div>

									<div className="flex items-center gap-1 flex-shrink-0 ml-2">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="cursor-pointer"
											onClick={() => openEdit(preset)}
										>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="cursor-pointer text-destructive hover:text-destructive"
											onClick={() => setDeleteTarget(preset)}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
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
							{activePreset ? t('page.editPreset') : t('page.addPreset')}
						</DialogTitle>
					</DialogHeader>
					<DevicePresetForm
						form={form}
						activePreset={activePreset}
						onReset={handleFormReset}
						onSubmit={() => {
							void handleFormSubmit();
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Sync Confirm Dialog */}
			<Dialog
				open={syncConfirmOpen}
				onOpenChange={(v) => {
					if (!v) setSyncConfirmOpen(false);
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t('page.syncTitle')}</DialogTitle>
						<DialogDescription>
							{t('page.syncDesc', { count: refCount })}
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 py-2">
						<Checkbox
							id="sync-profiles"
							checked={syncChecked}
							onCheckedChange={(v) => setSyncChecked(v === true)}
						/>
						<Label htmlFor="sync-profiles" className="cursor-pointer text-sm">
							{t('page.syncOption', { count: refCount })}
						</Label>
					</div>
					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setSyncConfirmOpen(false)}
							className="cursor-pointer"
						>
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							disabled={saving}
							onClick={() => { void handleSyncConfirm(); }}
							className="cursor-pointer"
						>
							{t('page.syncConfirm')}
						</Button>
					</DialogFooter>
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
							{deleting
								? t('common:deletingInProgress')
								: t('page.confirmDelete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
