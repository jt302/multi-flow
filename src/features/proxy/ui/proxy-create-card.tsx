import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';

import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import type { CreateProxyPayload, ProxyProtocol } from '@/features/proxy/model/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];

const createProxyFormSchema = (t: (key: string) => string) =>
	z.object({
		name: z.string().trim().min(1, t('common:errors.proxyNameRequired')),
		protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
		host: z.string().trim().min(1, t('common:errors.hostRequired')),
		port: z.coerce
			.number()
			.int(t('common:errors.portInteger'))
			.min(1, t('common:errors.portRange'))
			.max(65535, t('common:errors.portRange')),
		provider: z.string(),
		note: z.string(),
	});

type ProxyCreateFormValues = z.infer<ReturnType<typeof createProxyFormSchema>>;

type ProxyCreateCardProps = {
	pending: boolean;
	onCreateProxy: (payload: CreateProxyPayload) => Promise<void>;
};

export function ProxyCreateCard({ pending, onCreateProxy }: ProxyCreateCardProps) {
	const { t } = useTranslation();
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<ProxyCreateFormValues>({
		resolver: zodResolver(createProxyFormSchema(t)),
		defaultValues: {
			name: '',
			protocol: 'http',
			host: '',
			port: 8080,
			provider: '',
			note: '',
		},
	});

	return (
		<Card className="p-4">
			<CardHeader className="p-0">
				<CardTitle className="text-sm">
					{t('common:createItem', { item: t('common:proxy') })}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0 pt-3">
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (values) => {
						await onCreateProxy({
							name: values.name.trim(),
							protocol: values.protocol,
							host: values.host.trim(),
							port: values.port,
							provider: values.provider.trim(),
							note: values.note.trim(),
						});
						reset({
							name: '',
							protocol: 'http',
							host: '',
							port: 8080,
							provider: '',
							note: '',
						});
					})}
				>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('common:name')}</p>
						<Input {...register('name')} placeholder={t('common:placeholder.proxyNameExample')} />
						{errors.name ? (
							<p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
						) : null}
					</div>
					<div className="grid grid-cols-[120px_minmax(0,1fr)_90px] gap-2">
						<div>
							<Select
								value={watch('protocol')}
								onValueChange={(value: string) =>
									setValue('protocol', value as ProxyProtocol, { shouldValidate: true })
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t('common:protocol')} />
								</SelectTrigger>
								<SelectContent>
									{PROTOCOL_OPTIONS.map((protocol) => (
										<SelectItem key={protocol} value={protocol}>
											{protocol}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Input {...register('host')} placeholder={t('common:placeholder.hostIp')} />
							{errors.host ? (
								<p className="mt-1 text-xs text-destructive">{errors.host.message}</p>
							) : null}
						</div>
						<div>
							<Input
								type="number"
								{...register('port')}
								placeholder={t('common:placeholder.port')}
							/>
							{errors.port ? (
								<p className="mt-1 text-xs text-destructive">{errors.port.message}</p>
							) : null}
						</div>
					</div>
					<Input {...register('provider')} placeholder={t('common:protocol')} />
					<Input {...register('note')} placeholder={t('common:note')} />
					<Button type="submit" className="w-full" disabled={pending}>
						<Icon icon={Plus} size={14} />
						{t('common:createItem', { item: t('common:proxy') })}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
