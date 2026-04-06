import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { ProxyItem } from '@/entities/proxy/model/types';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type ProxySettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	availableProxies: ProxyItem[];
	proxyId: string;
};

export function ProxySettingsSection({
	form,
	availableProxies,
	proxyId,
}: ProxySettingsSectionProps) {
	const { t } = useTranslation('profile');
	const { setValue } = form;

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title={t('proxySettings.title')} description={t('proxySettings.desc')} />
			<Select
				value={proxyId || '__none__'}
				onValueChange={(value) => setValue('proxyId', value, { shouldDirty: true })}
			>
				<SelectTrigger>
					<SelectValue placeholder={t('proxySettings.noProxy')} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="__none__">{t('proxySettings.noProxy')}</SelectItem>
					{availableProxies.map((item) => (
						<SelectItem key={item.id} value={item.id}>
							{item.name} · {item.protocol.toUpperCase()}://{item.host}:{item.port}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{proxyId && proxyId !== '__none__' ? (
				<p className="mt-2 text-xs text-muted-foreground">
					{t('proxySettings.proxyHint')}
				</p>
			) : null}
		</div>
	);
}
