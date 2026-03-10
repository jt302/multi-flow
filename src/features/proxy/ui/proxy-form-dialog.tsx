import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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
import type { ProxyItem } from '@/entities/proxy/model/types';
import type {
	CreateProxyPayload,
	ProxyProtocol,
	UpdateProxyPayload,
} from '@/features/proxy/model/types';
import type { ProxyValueSource } from '@/entities/proxy/model/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];
const VALUE_SOURCE_OPTIONS: Array<{ value: ProxyValueSource; label: string }> = [
	{ value: 'ip', label: '基于 IP' },
	{ value: 'custom', label: '自定义' },
];

const proxyFormSchema = z
	.object({
		name: z.string().trim().min(1, '代理名称不能为空'),
		protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
		host: z.string().trim().min(1, '主机地址不能为空'),
		port: z.coerce.number().int('端口必须是整数').min(1, '端口必须在 1-65535 范围').max(65535, '端口必须在 1-65535 范围'),
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
				message: '语言来源为自定义时必须填写语言',
				path: ['customLanguage'],
			});
		}
		if (values.timezoneSource === 'custom' && !values.customTimezone.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '时区来源为自定义时必须填写时区',
				path: ['customTimezone'],
			});
		}
	});

type ProxyFormValues = z.infer<typeof proxyFormSchema>;

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
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<ProxyFormValues>({
		resolver: zodResolver(proxyFormSchema),
		defaultValues: DEFAULT_VALUES,
	});

	const isEdit = mode === 'edit';
	const title = isEdit ? '修改代理' : '新增代理';
	const description = isEdit
		? '可以修改代理名称、协议、认证信息，以及语言/时区来源配置。基于 IP 的项会在保存后自动重新检测。'
		: '填写代理基础信息后保存。若语言或时区选择基于 IP，保存后会自动检测出口画像。';
	const submitLabel = isEdit ? '保存修改' : '创建代理';

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
							values.languageSource === 'custom'
								? values.customLanguage.trim()
								: undefined,
						timezoneSource: values.timezoneSource,
						customTimezone:
							values.timezoneSource === 'custom'
								? values.customTimezone.trim()
								: undefined,
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
							values.languageSource === 'custom'
								? values.customLanguage.trim()
								: undefined,
						timezoneSource: values.timezoneSource,
						customTimezone:
							values.timezoneSource === 'custom'
								? values.customTimezone.trim()
								: undefined,
					});
				}
				onOpenChange(false);
			}),
		[handleSubmit, isEdit, onCreateProxy, onOpenChange, onUpdateProxy, proxy],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form className="space-y-3" onSubmit={submitHandler}>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">代理名称</p>
							<Input {...register('name')} placeholder="例如 Proxy-US-01" disabled={pending} />
							{errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name.message}</p> : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">协议</p>
							<Select value={protocolValue} onValueChange={(value) => setValue('protocol', value as ProxyProtocol, { shouldValidate: true })} disabled={pending}>
								<SelectTrigger className="w-full cursor-pointer">
									<SelectValue placeholder="协议" />
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
							<p className="mb-1 text-xs text-muted-foreground">主机</p>
							<Input {...register('host')} placeholder="host / ip" disabled={pending || isEdit} />
							{errors.host ? <p className="mt-1 text-xs text-destructive">{errors.host.message}</p> : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">端口</p>
							<Input type="number" {...register('port')} placeholder="port" disabled={pending || isEdit} />
							{errors.port ? <p className="mt-1 text-xs text-destructive">{errors.port.message}</p> : null}
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">用户名</p>
							<Input {...register('username')} placeholder="留空表示无认证" disabled={pending} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">密码</p>
							<Input type="password" {...register('password')} placeholder="留空表示无认证" disabled={pending} />
						</div>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">供应商</p>
						<Input {...register('provider')} placeholder="供应商" disabled={pending} />
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">过期时间</p>
						<Input type="datetime-local" {...register('expiresAt')} disabled={pending} />
					</div>
					<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
						<p className="mb-2 text-xs font-medium text-muted-foreground">语言 / 时区来源</p>
						<div className="grid gap-3 md:grid-cols-2">
							<div>
								<p className="mb-1 text-xs text-muted-foreground">语言来源</p>
								<Select
									value={languageSourceValue}
									onValueChange={(value) => setValue('languageSource', value as ProxyValueSource, { shouldValidate: true })}
									disabled={pending}
								>
									<SelectTrigger className="w-full cursor-pointer">
										<SelectValue placeholder="语言来源" />
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
										<Input {...register('customLanguage')} className="mt-2" placeholder="如 zh-CN / en-US" disabled={pending} />
										{errors.customLanguage ? <p className="mt-1 text-xs text-destructive">{errors.customLanguage.message}</p> : null}
									</>
								) : (
									<p className="mt-2 text-[11px] text-muted-foreground">保存后会基于代理出口 IP 和本地 GEO 数据自动推导。</p>
								)}
							</div>
							<div>
								<p className="mb-1 text-xs text-muted-foreground">时区来源</p>
								<Select
									value={timezoneSourceValue}
									onValueChange={(value) => setValue('timezoneSource', value as ProxyValueSource, { shouldValidate: true })}
									disabled={pending}
								>
									<SelectTrigger className="w-full cursor-pointer">
										<SelectValue placeholder="时区来源" />
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
										<Input {...register('customTimezone')} className="mt-2" placeholder="如 Asia/Shanghai" disabled={pending} />
										{errors.customTimezone ? <p className="mt-1 text-xs text-destructive">{errors.customTimezone.message}</p> : null}
									</>
								) : (
									<p className="mt-2 text-[11px] text-muted-foreground">保存后会基于代理出口 IP 和本地 GEO 数据自动推导。</p>
								)}
							</div>
						</div>
					</div>
					<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
						<p className="mb-2 text-xs font-medium text-muted-foreground">检测结果</p>
						<div className="grid gap-2 text-xs md:grid-cols-2">
							<p>出口 IP: {proxy?.exitIp || '未检测'}</p>
							<p>状态: {proxy?.checkStatus || 'unknown'}</p>
							<p>国家 / 区域: {proxy ? `${proxy.country || '未知'} / ${proxy.region || '未知'}` : '未检测'}</p>
							<p>城市: {proxy?.city || '未检测'}</p>
							<p>经纬度: {proxy && proxy.latitude !== null && proxy.longitude !== null ? `${proxy.latitude}, ${proxy.longitude}` : '未检测'}</p>
							<p>GEO 建议语言 / 时区: {proxy ? `${proxy.suggestedLanguage || '未检测'} / ${proxy.suggestedTimezone || '未检测'}` : '未检测'}</p>
							<p>当前生效语言 / 时区: {proxy ? `${proxy.effectiveLanguage || '未生效'} / ${proxy.effectiveTimezone || '未生效'}` : '未检测'}</p>
							<p>语言来源: {proxy ? `${proxy.languageSource === 'custom' ? '自定义' : '基于 IP'}${proxy.customLanguage ? ` (${proxy.customLanguage})` : ''}` : '未设置'}</p>
							<p>时区来源: {proxy ? `${proxy.timezoneSource === 'custom' ? '自定义' : '基于 IP'}${proxy.customTimezone ? ` (${proxy.customTimezone})` : ''}` : '未设置'}</p>
						</div>
						<div className="mt-2">
							<p className="mb-1 text-xs font-medium text-muted-foreground">目标站点可达性</p>
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
												<span className={item.reachable ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
													{item.reachable ? '可达' : '不可达'}
												</span>
												{item.statusCode ? <span className="text-muted-foreground">HTTP {item.statusCode}</span> : null}
												{item.error ? <span className="truncate text-muted-foreground">({item.error})</span> : null}
											</p>
										);
									})}
								</div>
							) : (
								<p className="text-xs text-muted-foreground">未检测</p>
							)}
						</div>
						{proxy?.checkMessage ? (
							<p className="mt-2 text-xs text-muted-foreground">检测说明: {proxy.checkMessage}</p>
						) : null}
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">备注</p>
						<Textarea {...register('note')} rows={4} placeholder="备注" disabled={pending} />
					</div>
					<DialogFooter>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending} onClick={() => onOpenChange(false)}>
							取消
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
