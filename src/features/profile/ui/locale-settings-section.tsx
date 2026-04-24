import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import { TimezoneCombobox } from '@/shared/ui/timezone-combobox';
import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type LocaleSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	localeMode: 'auto' | 'manual';
	languageSource: string;
	timezoneSource: string;
	onMarkManual: (field: 'language' | 'timezoneId') => void;
};

export function LocaleSettingsSection({
	form,
	localeMode,
	languageSource,
	timezoneSource,
	onMarkManual,
}: LocaleSettingsSectionProps) {
	const { t } = useTranslation('profile');
	const { register, setValue, watch } = form;
	const timezoneId = watch('timezoneId');
	const isAuto = localeMode === 'auto';

	function getSourceLabel(source: string) {
		if (source === 'proxy') return t('locale.sourceProxy');
		if (source === 'host') return t('locale.sourceHost');
		if (source === 'manual') return t('locale.sourceManual');
		return t('locale.sourceEmpty');
	}

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title={t('locale.title')} description={t('locale.desc')} />

			<div className="mb-3">
				<label className="mb-1 block text-xs text-muted-foreground">{t('locale.modeLabel')}</label>
				<Select
					value={localeMode}
					onValueChange={(value) =>
						setValue('localeMode', value as 'auto' | 'manual', {
							shouldDirty: true,
							shouldValidate: true,
						})
					}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="auto">{t('locale.modeAuto')}</SelectItem>
						<SelectItem value="manual">{t('locale.modeManual')}</SelectItem>
					</SelectContent>
				</Select>
				{isAuto && (
					<p className="mt-1 text-[11px] text-muted-foreground">{t('locale.modeAutoHint')}</p>
				)}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs text-muted-foreground">{t('locale.language')}</label>
					<Input
						{...register('language', {
							onChange: () => !isAuto && onMarkManual('language'),
						})}
						placeholder={isAuto ? undefined : t('locale.languagePlaceholder')}
						readOnly={isAuto}
						className={isAuto ? 'bg-muted/30 cursor-default' : ''}
					/>
					{isAuto && (
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('locale.sourceLabel')} {getSourceLabel(languageSource)}
						</p>
					)}
				</div>

				<div>
					<label className="mb-1 block text-xs text-muted-foreground">{t('locale.timezone')}</label>
					{isAuto ? (
						<Input
							value={timezoneId}
							readOnly
							className="bg-muted/30 cursor-default"
							placeholder={t('locale.timezonePlaceholder')}
						/>
					) : (
						<TimezoneCombobox
							value={timezoneId}
							onChange={(value) => {
								setValue('timezoneId', value, { shouldDirty: true, shouldValidate: true });
								onMarkManual('timezoneId');
							}}
						/>
					)}
					{isAuto && (
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('locale.sourceLabel')} {getSourceLabel(timezoneSource)}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
