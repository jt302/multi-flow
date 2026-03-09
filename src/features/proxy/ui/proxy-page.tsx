import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Plus, RefreshCw, RotateCcw, Trash2, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import {
	Badge,
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
import { ActiveSectionCard } from '@/features/console/components';
import { NAV_SECTIONS } from '@/features/console/constants';
import type {
	CreateProxyPayload,
	ProxyPageProps,
	ProxyProtocol,
} from '@/features/console/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];

const createProxyFormSchema = z.object({
	name: z.string().trim().min(1, '代理名称不能为空'),
	protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
	host: z.string().trim().min(1, '主机地址不能为空'),
	port: z
		.coerce
		.number()
		.int('端口必须是整数')
		.min(1, '端口必须在 1-65535 范围')
		.max(65535, '端口必须在 1-65535 范围'),
	country: z.string(),
	provider: z.string(),
	note: z.string(),
});

const proxyBindingFormSchema = z.object({
	profileId: z.string().trim().min(1, '请选择环境'),
	proxyId: z.string().trim().min(1, '请选择代理'),
});

type ProxyCreateFormValues = z.infer<typeof createProxyFormSchema>;
type ProxyBindingFormValues = z.infer<typeof proxyBindingFormSchema>;

function formatProxyAddress(protocol: string, host: string, port: number) {
	return `${protocol}://${host}:${port}`;
}

export function ProxyPage({
	proxies,
	profiles,
	profileProxyBindings,
	onCreateProxy,
	onDeleteProxy,
	onRestoreProxy,
	onBindProfileProxy,
	onUnbindProfileProxy,
	onRefreshProxies,
}: ProxyPageProps) {
	const section = NAV_SECTIONS.proxy;
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		handleSubmit: handleCreateSubmit,
		setValue: setCreateValue,
		watch: watchCreate,
		reset: resetCreate,
		formState: { errors: createErrors },
	} = useForm<ProxyCreateFormValues>({
		resolver: zodResolver(createProxyFormSchema),
		defaultValues: {
			name: '',
			protocol: 'http',
			host: '',
			port: 8080,
			country: '',
			provider: '',
			note: '',
		},
	});

	const {
		handleSubmit: handleBindingSubmit,
		setValue: setBindingValue,
		watch: watchBinding,
		formState: { errors: bindingErrors },
	} = useForm<ProxyBindingFormValues>({
		resolver: zodResolver(proxyBindingFormSchema),
		defaultValues: {
			profileId: '',
			proxyId: '',
		},
	});

	const selectedProfileId = watchBinding('profileId');
	const selectedProxyId = watchBinding('proxyId');

	const activeProxies = useMemo(() => proxies.filter((item) => item.lifecycle === 'active'), [proxies]);
	const activeProfiles = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'active'),
		[profiles],
	);
	const proxyById = useMemo(() => {
		const map = new Map<string, (typeof proxies)[number]>();
		for (const item of proxies) {
			map.set(item.id, item);
		}
		return map;
	}, [proxies]);

	const boundRows = useMemo(
		() =>
			activeProfiles
				.filter((profile) => profileProxyBindings[profile.id])
				.map((profile) => ({
					profile,
					proxy: proxyById.get(profileProxyBindings[profile.id] ?? ''),
				}))
				.filter((item) => Boolean(item.proxy)),
		[activeProfiles, profileProxyBindings, proxyById],
	);

	useEffect(() => {
		if (!selectedProfileId || !activeProfiles.some((item) => item.id === selectedProfileId)) {
			setBindingValue('profileId', activeProfiles[0]?.id ?? '', { shouldValidate: true });
		}
	}, [activeProfiles, selectedProfileId, setBindingValue]);

	useEffect(() => {
		if (!selectedProxyId || !activeProxies.some((item) => item.id === selectedProxyId)) {
			setBindingValue('proxyId', activeProxies[0]?.id ?? '', { shouldValidate: true });
		}
	}, [activeProxies, selectedProxyId, setBindingValue]);

	const runAction = async (fn: () => Promise<void>) => {
		if (pending) {
			return;
		}
		setPending(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : '代理操作失败');
		} finally {
			setPending(false);
		}
	};

	const handleCreateProxy = async (values: ProxyCreateFormValues) => {
		const payload: CreateProxyPayload = {
			name: values.name.trim(),
			protocol: values.protocol,
			host: values.host.trim(),
			port: values.port,
			country: values.country.trim(),
			provider: values.provider.trim(),
			note: values.note.trim(),
		};

		await runAction(async () => {
			await onCreateProxy(payload);
			resetCreate({
				name: '',
				protocol: 'http',
				host: '',
				port: 8080,
				country: '',
				provider: '',
				note: '',
			});
		});
	};

	const handleBindProxy = async (values: ProxyBindingFormValues) => {
		await runAction(async () => {
			await onBindProfileProxy(values.profileId, values.proxyId);
		});
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="代理池" title={section.title} description={section.desc} />

			<div className="grid gap-3 md:grid-cols-3">
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">代理总数</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{proxies.length}</p>
					</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">可用代理</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{activeProxies.length}</p>
					</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">已绑定环境</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{boundRows.length}</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
				<Card className="p-3">
					<div className="mb-2 flex items-center justify-between px-1">
						<h2 className="text-sm font-semibold">代理列表</h2>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								void runAction(onRefreshProxies);
							}}
						>
							<Icon icon={RefreshCw} size={12} />
							刷新
						</Button>
					</div>

					<div className="overflow-hidden rounded-xl border border-border/70">
						{proxies.length === 0 ? (
							<div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无代理，请先新增。</div>
						) : (
							proxies.map((item, index) => (
								<div
									key={item.id}
									className={`grid grid-cols-[minmax(0,1fr)_96px_132px] items-center gap-3 px-3 py-3 text-sm ${
										index < proxies.length - 1 ? 'border-b border-border/70' : ''
									}`}
								>
									<div className="min-w-0">
										<p className="truncate font-medium">{item.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{formatProxyAddress(item.protocol, item.host, item.port)}
										</p>
										<p className="truncate text-[11px] text-muted-foreground">
											{item.country || '未知国家'} · {item.provider || '未填写供应商'}
										</p>
									</div>
									<div>
										<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>
											{item.lifecycle === 'active' ? '可用' : '已归档'}
										</Badge>
									</div>
									<div className="flex justify-end gap-1">
										{item.lifecycle === 'active' ? (
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="h-8 w-8"
												disabled={pending}
												onClick={() => {
													void runAction(() => onDeleteProxy(item.id));
												}}
											>
												<Icon icon={Trash2} size={13} />
											</Button>
										) : (
											<Button
												type="button"
												size="sm"
												variant="outline"
												disabled={pending}
												onClick={() => {
													void runAction(() => onRestoreProxy(item.id));
												}}
											>
												<Icon icon={RotateCcw} size={12} />
												恢复
											</Button>
										)}
									</div>
								</div>
							))
						)}
					</div>
				</Card>

				<div className="space-y-3">
					<Card className="p-4">
						<CardHeader className="p-0">
							<CardTitle className="text-sm">新增代理</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-3">
							<form className="space-y-3" onSubmit={handleCreateSubmit(handleCreateProxy)}>
								<div>
									<p className="mb-1 text-xs text-muted-foreground">代理名称</p>
									<Input {...register('name')} placeholder="例如 Proxy-US-01" />
									{createErrors.name ? (
										<p className="mt-1 text-xs text-destructive">{createErrors.name.message}</p>
									) : null}
								</div>
								<div className="grid grid-cols-[120px_minmax(0,1fr)_90px] gap-2">
									<div>
										<Select
											value={watchCreate('protocol')}
											onValueChange={(value: string) =>
												setCreateValue('protocol', value as ProxyProtocol, { shouldValidate: true })
											}
										>
											<SelectTrigger className="w-full">
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
									<div>
										<Input {...register('host')} placeholder="host / ip" />
										{createErrors.host ? (
											<p className="mt-1 text-xs text-destructive">{createErrors.host.message}</p>
										) : null}
									</div>
									<div>
										<Input
											type="number"
											{...register('port')}
											placeholder="port"
										/>
										{createErrors.port ? (
											<p className="mt-1 text-xs text-destructive">{createErrors.port.message}</p>
										) : null}
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Input {...register('country')} placeholder="国家代码（US/CN）" />
									<Input {...register('provider')} placeholder="供应商" />
								</div>
								<Input {...register('note')} placeholder="备注" />
								<Button type="submit" className="w-full" disabled={pending}>
									<Icon icon={Plus} size={14} />
									新增代理
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card className="p-4">
						<CardHeader className="p-0">
							<CardTitle className="text-sm">环境绑定</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-3">
							<form className="space-y-3" onSubmit={handleBindingSubmit(handleBindProxy)}>
								<div>
									<Select
										value={selectedProfileId}
										onValueChange={(value) =>
											setBindingValue('profileId', value, { shouldValidate: true })
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="选择环境" />
										</SelectTrigger>
										<SelectContent>
											{activeProfiles.map((profile) => (
												<SelectItem key={profile.id} value={profile.id}>
													{profile.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{bindingErrors.profileId ? (
										<p className="mt-1 text-xs text-destructive">{bindingErrors.profileId.message}</p>
									) : null}
								</div>
								<div>
									<Select
										value={selectedProxyId}
										onValueChange={(value) =>
											setBindingValue('proxyId', value, { shouldValidate: true })
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="选择代理" />
										</SelectTrigger>
										<SelectContent>
											{activeProxies.map((proxy) => (
												<SelectItem key={proxy.id} value={proxy.id}>
													{proxy.name} ({proxy.protocol})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{bindingErrors.proxyId ? (
										<p className="mt-1 text-xs text-destructive">{bindingErrors.proxyId.message}</p>
									) : null}
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Button
										type="submit"
										variant="outline"
										disabled={pending || !selectedProfileId || !selectedProxyId}
									>
										<Icon icon={Link2} size={13} />
										绑定
									</Button>
									<Button
										type="button"
										variant="outline"
										disabled={pending || !selectedProfileId}
										onClick={() => {
											void runAction(() => onUnbindProfileProxy(selectedProfileId));
										}}
									>
										<Icon icon={Unlink2} size={13} />
										解绑
									</Button>
								</div>
								<div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 p-2">
									{boundRows.length === 0 ? (
										<p className="px-1 py-6 text-center text-xs text-muted-foreground">暂无绑定关系</p>
									) : (
										boundRows.map(({ profile, proxy }) => (
											<div
												key={profile.id}
												className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-2 py-1.5"
											>
												<div className="min-w-0">
													<p className="truncate text-xs font-medium">{profile.name}</p>
													<p className="truncate text-[11px] text-muted-foreground">{proxy?.name}</p>
												</div>
												<Button
													type="button"
													size="icon"
													variant="ghost"
													className="h-7 w-7"
													disabled={pending}
													onClick={() => {
														void runAction(() => onUnbindProfileProxy(profile.id));
													}}
												>
													<Icon icon={Unlink2} size={12} />
												</Button>
											</div>
										))
									)}
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}
