import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

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
import type { CreateProxyPayload, ProxyProtocol, UpdateProxyPayload } from '@/features/proxy/model/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];

const proxyFormSchema = z.object({
	name: z.string().trim().min(1, '代理名称不能为空'),
	protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
	host: z.string().trim().min(1, '主机地址不能为空'),
	port: z.coerce.number().int('端口必须是整数').min(1, '端口必须在 1-65535 范围').max(65535, '端口必须在 1-65535 范围'),
	username: z.string(),
	password: z.string(),
	provider: z.string(),
	note: z.string(),
	expiresAt: z.string(),
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
};

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
		? '可以修改代理名称、协议、认证信息、供应商、过期时间和备注。地理信息由检测自动维护。'
		: '填写代理基础信息后保存。';
	const submitLabel = isEdit ? '保存修改' : '创建代理';

	useEffect(() => {
		if (!open) {
			reset(DEFAULT_VALUES);
			return;
		}
		reset(toFormValues(proxy));
	}, [open, proxy, reset]);

	const protocolValue = watch('protocol');
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
						<p className="mb-2 text-xs font-medium text-muted-foreground">检测结果</p>
						<div className="grid gap-2 text-xs md:grid-cols-2">
							<p>出口 IP: {proxy?.exitIp || '未检测'}</p>
							<p>状态: {proxy?.checkStatus || 'unknown'}</p>
							<p>国家 / 区域: {proxy ? `${proxy.country || '未知'} / ${proxy.region || '未知'}` : '未检测'}</p>
							<p>城市: {proxy?.city || '未检测'}</p>
							<p>经纬度: {proxy && proxy.latitude !== null && proxy.longitude !== null ? `${proxy.latitude}, ${proxy.longitude}` : '未检测'}</p>
							<p>建议语言 / 时区: {proxy ? `${proxy.suggestedLanguage || '未检测'} / ${proxy.suggestedTimezone || '未检测'}` : '未检测'}</p>
						</div>
						{proxy?.checkMessage ? (
							<p className="mt-2 text-xs text-muted-foreground">错误信息: {proxy.checkMessage}</p>
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
