import { Palette, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, Icon, Input } from '@/components/ui';
import { normalizeCustomThemePreset } from '@/entities/theme/model/custom-presets';
import { THEME_PRESET_KEYS, THEME_PRESETS } from '@/entities/theme/model/presets';
import type { ThemeCustomizerCardProps } from '@/features/settings/model/types';
import { cn } from '@/lib/utils';

export function ThemeCustomizerCard({
	useCustomColor,
	preset,
	customColor,
	customPresets,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
	onAddCustomPreset,
	onApplyCustomPreset,
	onDeleteCustomPreset,
}: ThemeCustomizerCardProps) {
	const { t } = useTranslation('settings');
	const customColorPickerId = 'theme-custom-color-picker';
	const customColorTextId = 'theme-custom-color-text';
	const normalizedCustomColor = normalizeCustomThemePreset(customColor);
	const hasSavedCustomPreset = normalizedCustomColor
		? customPresets.includes(normalizedCustomColor)
		: false;
	const toggleLabel = useCustomColor
		? t('theme.switchToPresetTheme')
		: t('theme.switchToCustomTheme');

	return (
		<Card className="min-w-0 gap-5 p-5">
			<div className="flex items-center gap-2">
				<Icon icon={Palette} size={15} />
				<h3 className="text-sm font-semibold">{t('theme.title')}</h3>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-sm font-medium">{t('theme.presetSection')}</p>
						<p className="text-xs text-muted-foreground">{t('theme.dualMode')}</p>
					</div>
					<Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
						{useCustomColor ? t('theme.customSection') : t('theme.presetSection')}
					</Badge>
				</div>

				<div className="flex flex-wrap gap-2">
					{THEME_PRESET_KEYS.map((item) => (
						<Button
							key={item}
							type="button"
							variant="outline"
							onClick={() => onPresetChange(item)}
							className={cn(
								'h-auto flex-1 min-w-[8.5rem] flex-col items-start gap-1.5 rounded-2xl border-border/70 bg-background/70 px-3 py-3 text-left text-xs shadow-none',
								!useCustomColor &&
									preset === item &&
									'border-primary bg-primary/12 text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)]',
							)}
						>
							<div className="flex items-center gap-1.5 font-medium capitalize">
								<span
									className="inline-block h-2.5 w-2.5 rounded-full"
									style={{ backgroundColor: THEME_PRESETS[item].light }}
								/>
								{item}
							</div>
							<p className="text-[11px] text-muted-foreground">{t('theme.dualMode')}</p>
						</Button>
					))}
				</div>
			</div>

			<Card className="self-start w-fit max-w-full gap-4 rounded-2xl border-border/60 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-none">
				<div className="space-y-1">
					<p className="text-sm font-medium">{t('theme.customSection')}</p>
					<p className="text-xs text-muted-foreground">{t('theme.customPrimaryColor')}</p>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-medium text-muted-foreground">{t('theme.customPresets')}</p>
						{hasSavedCustomPreset ? (
							<Badge variant="secondary" className="rounded-full px-2 py-0.5">
								{t('theme.customPresetExists')}
							</Badge>
						) : null}
					</div>

					{customPresets.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{customPresets.map((item) => (
								<div
									key={item}
									className={cn(
										'group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs shadow-xs transition-colors',
										useCustomColor &&
											normalizedCustomColor === item &&
											'border-primary bg-primary/10',
									)}
								>
									<button
										type="button"
										onClick={() => onApplyCustomPreset(item)}
										className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium"
									>
										<span className="size-2.5 rounded-full" style={{ backgroundColor: item }} />
										{item}
									</button>
									<Button
										type="button"
										size="icon-xs"
										variant="ghost"
										className="rounded-full opacity-70 transition-opacity group-hover:opacity-100"
										onClick={() => onDeleteCustomPreset(item)}
										aria-label={`${t('theme.deleteCustomPreset')} ${item}`}
									>
										<X className="size-3" />
									</Button>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-4 text-xs text-muted-foreground">
							{t('theme.noCustomPresets')}
						</div>
					)}
				</div>

				<div className="space-y-2">
					<label htmlFor={customColorTextId} className="text-xs text-muted-foreground">
						{t('theme.customPrimaryColor')}
					</label>
					<div className="flex flex-nowrap items-center gap-2">
						<Input
							id={customColorPickerId}
							type="color"
							value={normalizedCustomColor ?? '#0F8A73'}
							onChange={(event) => onCustomColorChange(event.target.value)}
							className="h-8 w-12 shrink-0 cursor-pointer rounded-xl border-border/70 bg-background p-1"
						/>
						<Input
							id={customColorTextId}
							type="text"
							value={customColor}
							onChange={(event) => onCustomColorChange(event.target.value)}
							className="h-8 w-[8.5rem] shrink-0 rounded-xl border-border/70 bg-background uppercase tracking-[0.16em]"
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onAddCustomPreset}
							disabled={!normalizedCustomColor || hasSavedCustomPreset}
							className="shrink-0 rounded-xl border-border/70"
						>
							<Plus className="size-4" />
							{t('theme.addToCustomPresets')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant={useCustomColor ? 'default' : 'outline'}
							onClick={onToggleCustomColor}
							className="shrink-0 rounded-xl px-4"
						>
							{toggleLabel}
						</Button>
					</div>
				</div>
			</Card>
		</Card>
	);
}
