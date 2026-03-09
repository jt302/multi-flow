import { zodResolver } from '@hookform/resolvers/zod';
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
	country: z.string(),
	region: z.string(),
	city: z.string(),
	provider: z.string(),
	note: z.string(),
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
	country: '',
	region: '',
	city: '',
	provider: '',
	note: '',
};

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
		country: proxy.country,
		region: proxy.region,
		city: proxy.city,
		provider: proxy.provider,
		note: proxy.note,
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
		? '可以修改代理名称、认证信息、区域、供应商和备注。主机与端口不可修改。'
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
						country: values.country.trim(),
						region: values.region.trim(),
						city: values.city.trim(),
						provider: values.provider.trim(),
						note: values.note.trim(),
					});
				} else {
					await onCreateProxy({
						name: values.name.trim(),
						protocol: values.protocol,
						host: values.host.trim(),
						port: values.port,
						username: values.username.trim(),
						password: values.password.trim(),
						country: values.country.trim(),
						region: values.region.trim(),
						city: values.city.trim(),
						provider: values.provider.trim(),
						note: values.note.trim(),
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
					<div className="grid gap-3 md:grid-cols-3">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">国家</p>
							<Input {...register('country')} placeholder="国家代码" disabled={pending} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">区域</p>
							<Input {...register('region')} placeholder="区域" disabled={pending} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">城市</p>
							<Input {...register('city')} placeholder="城市" disabled={pending} />
						</div>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">供应商</p>
						<Input {...register('provider')} placeholder="供应商" disabled={pending} />
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
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
