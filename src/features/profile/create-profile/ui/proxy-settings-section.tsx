import type { UseFormReturn } from 'react-hook-form';

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
	const { setValue } = form;

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title="代理配置" description="创建环境时直接绑定代理" />
			<Select
				value={proxyId || '__none__'}
				onValueChange={(value) => setValue('proxyId', value, { shouldDirty: true })}
			>
				<SelectTrigger>
					<SelectValue placeholder="不绑定代理" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="__none__">不绑定代理</SelectItem>
					{availableProxies.map((item) => (
						<SelectItem key={item.id} value={item.id}>
							{item.name} · {item.protocol.toUpperCase()}://{item.host}:{item.port}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
