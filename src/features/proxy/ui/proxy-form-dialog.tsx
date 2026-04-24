import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';
import GoogleIcon from '@/assets/icon/google.svg?react';
import YouTubeIcon from '@/assets/icon/youtube.svg?react';

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { ProxyItem, ProxyValueSource } from '@/entities/proxy/model/types';
import type {
	CreateProxyPayload,
	ProxyProtocol,
	UpdateProxyPayload,
} from '@/features/proxy/model/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];

const proxyFormSchema = (t: (key: string) => string) =>
	z
		.object({
			name: z.string().trim().min(1, t('common:errors.proxyNameRequired')),
			protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
			host: z.string().trim().min(1, t('common:errors.hostRequired')),
			port: z.coerce
				.number()
				.int(t('common:errors.portInteger'))
				.min(1, t('common:errors.portRange'))
				.max(65535, t('common:errors.portRange')),
			username: z.string(),
			password: z.string(),
			provider: z.string(),
			note: z.string(),
			expiresAt: z.string(),
			languageSource: z.enum(['ip', 'custom']),
			customLanguage: z.string(),
			timezoneSource: z.enum(['ip', 'custom']),
			customTimezone: z.string(),
		})
		.superRefine((values, ctx) => {
			if (values.languageSource === 'custom' && !values.customLanguage.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t('common:customLanguageRequired'),
					path: ['customLanguage'],
				});
			}
			if (values.timezoneSource === 'custom' && !values.customTimezone.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t('common:customTimezoneRequired'),
					path: ['customTimezone'],
				});
			}
		});

type ProxyFormValues = z.infer<ReturnType<typeof proxyFormSchema>>;

type ProxyFormDialogProps = {
	open: boolean;
	pending: boolean;
	mode: 'create' | 'edit';
	proxy: ProxyItem | null;
	onOpenChange: (open: boolean) => void;
	onCreateProxy: (payload: CreateProxyPayload) => Promise<void>;
	onUpdateProxy: (proxyId: string, payload: UpdateProxyPayload) => Promise<void>;
};

const DEFAULT_VALUES: ProxyFormValues = {
	name: '',
	protocol: 'http',
	host: '',
	port: 8080,
	username: '',
	password: '',
	provider: '',
	note: '',
	expiresAt: '',
	languageSource: 'ip',
	customLanguage: '',
	timezoneSource: 'ip',
	customTimezone: '',
};

const TARGET_SITE_META = {
	'google.com': { label: 'Google', IconComponent: GoogleIcon },
	'youtube.com': { label: 'YouTube', IconComponent: YouTubeIcon },
} as const;

function toDateTimeLocalValue(value: number | null) {
	if (!value) return '';
	const date = new Date(value * 1000);
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60_000);
	return local.toISOString().slice(0, 16);
}

function parseDateTimeLocalValue(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const timestamp = Date.parse(trimmed);
	if (Number.isNaN(timestamp)) return null;
	return Math.floor(timestamp / 1000);
}

function toFormValues(proxy: ProxyItem | null): ProxyFormValues {
	if (!proxy) {
		return DEFAULT_VALUES;
	}
	return {
		name: proxy.name,
		protocol: proxy.protocol,
		host: proxy.host,
		port: proxy.port,
		username: proxy.username,
		password: proxy.password,
		provider: proxy.provider,
		note: proxy.note,
		expiresAt: toDateTimeLocalValue(proxy.expiresAt),
		languageSource: proxy.languageSource,
		customLanguage: proxy.customLanguage,
		timezoneSource: proxy.timezoneSource,
		customTimezone: proxy.customTimezone,
	};
}

export function ProxyFormDialog({
	open,
	pending,
	mode,
	proxy,
	onOpenChange,
	onCreateProxy,
	onUpdateProxy,
}: ProxyFormDialogProps) {
	const { t } = useTranslation();
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<ProxyFormValues>({
		resolver: zodResolver(proxyFormSchema(t)),
		defaultValues: DEFAULT_VALUES,
	});

	const isEdit = mode === 'edit';
	const title = isEdit
		? t('common:editItem', { item: t('common:proxy') })
		: t('common:createItem', { item: t('common:proxy') });
	const description = isEdit ? t('proxy:editDescription') : t('proxy:createDescription');
	const submitLabel = isEdit
		? t('common:saveChanges')
		: t('common:createItem', { item: t('common:proxy') });

	useEffect(() => {
		if (!open) {
			reset(DEFAULT_VALUES);
			return;
		}
		reset(toFormValues(proxy));
	}, [open, proxy, reset]);

	const protocolValue = watch('protocol');
	const languageSourceValue = watch('languageSource');
	const timezoneSourceValue = watch('timezoneSource');

	const VALUE_SOURCE_OPTIONS: Array<{ value: ProxyValueSource; label: string }> = [
		{ value: 'ip', label: t('common:followIp') },
		{ value: 'custom', label: t('common:custom') },
	];

	const submitHandler = useMemo(
		() =>
			handleSubmit(async (values) => {
				if (isEdit && proxy) {
					await onUpdateProxy(proxy.id, {
						name: values.name.trim(),
						protocol: values.protocol,
						username: values.username.trim(),
						password: values.password.trim(),
						provider: values.provider.trim(),
						note: values.note.trim(),
						expiresAt: parseDateTimeLocalValue(values.expiresAt),
						languageSource: values.languageSource,
						customLanguage:
							values.languageSource === 'custom' ? values.customLanguage.trim() : undefined,
						timezoneSource: values.timezoneSource,
						customTimezone:
							values.timezoneSource === 'custom' ? values.customTimezone.trim() : undefined,
					});
				} else {
					await onCreateProxy({
						name: values.name.trim(),
						protocol: values.protocol,
						host: values.host.trim(),
						port: values.port,
						username: values.username.trim(),
						password: values.password.trim(),
						provider: values.provider.trim(),
						note: values.note.trim(),
						expiresAt: parseDateTimeLocalValue(values.expiresAt),
						languageSource: values.languageSource,
						customLanguage:
							values.languageSource === 'custom' ? values.customLanguage.trim() : undefined,
						timezoneSource: values.timezoneSource,
						customTimezone:
							values.timezoneSource === 'custom' ? values.customTimezone.trim() : undefined,
					});
				}
				onOpenChange(false);
			}),
		[handleSubmit, isEdit, onCreateProxy, onOpenChange, onUpdateProxy, proxy],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form className="space-y-3" onSubmit={submitHandler}>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:name')}</p>
							<Input
								{...register('name')}
								placeholder={t('common:placeholder.proxyNameExample')}
								disabled={pending}
							/>
							{errors.name ? (
								<p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:protocol')}</p>
							<Select
								value={protocolValue}
								onValueChange={(value) =>
									setValue('protocol', value as ProxyProtocol, { shouldValidate: true })
								}
								disabled={pending}
							>
								<SelectTrigger className="w-full cursor-pointer">
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
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:host')}</p>
							<Input
								{...register('host')}
								placeholder={t('common:placeholder.hostIp')}
								disabled={pending || isEdit}
							/>
							{errors.host ? (
								<p className="mt-1 text-xs text-destructive">{errors.host.message}</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:port')}</p>
							<Input
								type="number"
								{...register('port')}
								placeholder={t('common:placeholder.port')}
								disabled={pending || isEdit}
							/>
							{errors.port ? (
								<p className="mt-1 text-xs text-destructive">{errors.port.message}</p>
							) : null}
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:username')}</p>
							<Input
								{...register('username')}
								placeholder={t('common:placeholder.leaveEmpty')}
								disabled={pending}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:password')}</p>
							<Input
								type="password"
								{...register('password')}
								placeholder={t('common:placeholder.leaveEmpty')}
								disabled={pending}
							/>
						</div>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('common:provider')}</p>
						<Input
							{...register('provider')}
							placeholder={t('common:provider')}
							disabled={pending}
						/>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('common:expiresAt')}</p>
						<Input type="datetime-local" {...register('expiresAt')} disabled={pending} />
					</div>
					<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
						<p className="mb-2 text-xs font-medium text-muted-foreground">
							{t('proxy:langTimezoneSource')}
						</p>
						<div className="grid gap-3 md:grid-cols-2">
							<div>
								<p className="mb-1 text-xs text-muted-foreground">{t('proxy:languageSource')}</p>
								<Select
									value={languageSourceValue}
									onValueChange={(value) =>
										setValue('languageSource', value as ProxyValueSource, { shouldValidate: true })
									}
									disabled={pending}
								>
									<SelectTrigger className="w-full cursor-pointer">
										<SelectValue placeholder={t('proxy:languageSource')} />
									</SelectTrigger>
									<SelectContent>
										{VALUE_SOURCE_OPTIONS.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{languageSourceValue === 'custom' ? (
									<>
										<Input
											{...register('customLanguage')}
											className="mt-2"
											placeholder="zh-CN / en-US"
											disabled={pending}
										/>
										{errors.customLanguage ? (
											<p className="mt-1 text-xs text-destructive">
												{errors.customLanguage.message}
											</p>
										) : null}
									</>
								) : (
									<p className="mt-2 text-[11px] text-muted-foreground">
										{t('proxy:autoDeriveHint')}
									</p>
								)}
							</div>
							<div>
								<p className="mb-1 text-xs text-muted-foreground">{t('proxy:timezoneSource')}</p>
								<Select
									value={timezoneSourceValue}
									onValueChange={(value) =>
										setValue('timezoneSource', value as ProxyValueSource, { shouldValidate: true })
									}
									disabled={pending}
								>
									<SelectTrigger className="w-full cursor-pointer">
										<SelectValue placeholder={t('proxy:timezoneSource')} />
									</SelectTrigger>
									<SelectContent>
										{VALUE_SOURCE_OPTIONS.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{timezoneSourceValue === 'custom' ? (
									<>
										<Input
											{...register('customTimezone')}
											className="mt-2"
											placeholder="Asia/Shanghai"
											disabled={pending}
										/>
										{errors.customTimezone ? (
											<p className="mt-1 text-xs text-destructive">
												{errors.customTimezone.message}
											</p>
										) : null}
									</>
								) : (
									<p className="mt-2 text-[11px] text-muted-foreground">
										{t('proxy:autoDeriveHint')}
									</p>
								)}
							</div>
						</div>
					</div>
					<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
						<p className="mb-2 text-xs font-medium text-muted-foreground">
							{t('proxy:checkResults')}
						</p>
						<div className="grid gap-2 text-xs md:grid-cols-2">
							<p>
								{t('proxy:exitIp')}: {proxy?.exitIp || t('common:notDetected')}
							</p>
							<p>
								{t('common:status')}: {proxy?.checkStatus || 'unknown'}
							</p>
							<p>
								{t('proxy:countryRegion')}:{' '}
								{proxy
									? `${proxy.country || t('common:unknown')} / ${proxy.region || t('common:unknown')}`
									: t('common:notDetected')}
							</p>
							<p>
								{t('proxy:city')}: {proxy?.city || t('common:notDetected')}
							</p>
							<p>
								{t('proxy:latLong')}:{' '}
								{proxy && proxy.latitude !== null && proxy.longitude !== null
									? `${proxy.latitude}, ${proxy.longitude}`
									: t('common:notDetected')}
							</p>
							<p>
								{t('proxy:geoSuggestion')}:{' '}
								{proxy
									? `${proxy.suggestedLanguage || t('common:notDetected')} / ${proxy.suggestedTimezone || t('common:notDetected')}`
									: t('common:notDetected')}
							</p>
							<p>
								{t('proxy:currentEffective')}:{' '}
								{proxy
									? `${proxy.effectiveLanguage || t('common:notSet')} / ${proxy.effectiveTimezone || t('common:notSet')}`
									: t('common:notDetected')}
							</p>
							<p>
								{t('proxy:languageSource')}:{' '}
								{proxy
									? `${proxy.languageSource === 'custom' ? t('common:custom') : t('common:followIp')}${proxy.customLanguage ? ` (${proxy.customLanguage})` : ''}`
									: t('common:notSet')}
							</p>
							<p>
								{t('proxy:timezoneSource')}:{' '}
								{proxy
									? `${proxy.timezoneSource === 'custom' ? t('common:custom') : t('common:followIp')}${proxy.customTimezone ? ` (${proxy.customTimezone})` : ''}`
									: t('common:notSet')}
							</p>
						</div>
						<div className="mt-2">
							<p className="mb-1 text-xs font-medium text-muted-foreground">
								{t('common:targetSiteChecks')}
							</p>
							{proxy?.targetSiteChecks.length ? (
								<div className="space-y-1 text-xs">
									{proxy.targetSiteChecks.map((item) => {
										const normalizedSite = item.site.trim().toLowerCase();
										const meta = TARGET_SITE_META[normalizedSite as keyof typeof TARGET_SITE_META];
										const IconComponent = meta?.IconComponent;
										const label = meta?.label ?? item.site;
										return (
											<p key={`${proxy.id}-${item.site}`} className="flex items-center gap-1">
												{IconComponent ? <IconComponent className="h-3.5 w-3.5 shrink-0" /> : null}
												<span className="text-muted-foreground">{label}:</span>
												<span
													className={
														item.reachable
															? 'text-emerald-600 dark:text-emerald-400'
															: 'text-destructive'
													}
												>
													{item.reachable ? t('common:reachable') : t('common:unreachable')}
												</span>
												{item.statusCode ? (
													<span className="text-muted-foreground">HTTP {item.statusCode}</span>
												) : null}
												{item.error ? (
													<span className="truncate text-muted-foreground">({item.error})</span>
												) : null}
											</p>
										);
									})}
								</div>
							) : (
								<p className="text-xs text-muted-foreground">{t('common:notDetected')}</p>
							)}
						</div>
						{proxy?.checkMessage ? (
							<p className="mt-2 text-xs text-muted-foreground">
								{t('proxy:checkMessage')}: {proxy.checkMessage}
							</p>
						) : null}
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('common:note')}</p>
						<Textarea
							{...register('note')}
							rows={4}
							placeholder={t('common:note')}
							disabled={pending}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							className="cursor-pointer"
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							{t('common:cancel')}
						</Button>
						<Button type="submit" className="cursor-pointer" disabled={pending}>
							{pending ? <LoaderCircle className="animate-spin" /> : null}
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
