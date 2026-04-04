import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, LoaderCircle, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Icon,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import type {
	ProfileItem,
	ProfileProxyBindingMap,
} from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

type Values = {
	profileId: string;
	proxyId: string;
};

type ProxyBindingDialogProps = {
	open: boolean;
	pending: boolean;
	profiles: ProfileItem[];
	activeProxies: ProxyItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	initialProxyId?: string | null;
	onOpenChange: (open: boolean) => void;
	onBindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	onUnbindProfileProxy: (profileId: string) => Promise<void>;
};

export function ProxyBindingDialog({
	open,
	pending,
	profiles,
	activeProxies,
	profileProxyBindings,
	initialProxyId,
	onOpenChange,
	onBindProfileProxy,
	onUnbindProfileProxy,
}: ProxyBindingDialogProps) {
	const { t } = useTranslation(['proxy', 'common']);
	const [unbindProfileId, setUnbindProfileId] = useState<string | null>(null);
	const {
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<Values>({
		resolver: zodResolver(z.object({
			profileId: z.string().trim().min(1, t('common:placeholder.selectProfile')),
			proxyId: z.string().trim().min(1, t('common:placeholder.selectProxy')),
		})),
		defaultValues: { profileId: '', proxyId: '' },
	});

	const activeProfiles = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'active'),
		[profiles],
	);
	const activeProxyIds = useMemo(
		() => activeProxies.map((item) => item.id).join(','),
		[activeProxies],
	);
	const selectedProfileId = watch('profileId');
	const selectedProxyId = watch('proxyId');
	const boundRows = activeProfiles
		.filter((profile) => profileProxyBindings[profile.id])
		.map((profile) => ({
			profile,
			proxy: activeProxies.find(
				(proxy) => proxy.id === profileProxyBindings[profile.id],
			),
		}))
		.filter((item) => Boolean(item.proxy))
		.filter((item) =>
			initialProxyId ? item.proxy?.id === initialProxyId : true,
		);

	useEffect(() => {
		if (!open) {
			setUnbindProfileId(null);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		if (
			!selectedProfileId ||
			!activeProfiles.some((item) => item.id === selectedProfileId)
		) {
			const fallback = activeProfiles[0]?.id ?? '';
			if (selectedProfileId !== fallback) {
				setValue('profileId', fallback, { shouldValidate: true });
			}
		}
	}, [open, activeProfiles, selectedProfileId, setValue]);

	useEffect(() => {
		if (!open) return;
		if (
			initialProxyId &&
			activeProxies.some((item) => item.id === initialProxyId)
		) {
			if (selectedProxyId !== initialProxyId) {
				setValue('proxyId', initialProxyId, { shouldValidate: true });
			}
			return;
		}
		if (
			!selectedProxyId ||
			!activeProxies.some((item) => item.id === selectedProxyId)
		) {
			const fallback = activeProxies[0]?.id ?? '';
			if (selectedProxyId !== fallback) {
				setValue('proxyId', fallback, { shouldValidate: true });
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, activeProxyIds, initialProxyId, selectedProxyId, setValue]);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t('proxy:binding')}</DialogTitle>
						<DialogDescription>{t('proxy:bindingDesc')}</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-3"
						onSubmit={handleSubmit(async (values) => {
							await onBindProfileProxy(values.profileId, values.proxyId);
						})}
					>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:profile')}</p>
							<Select
								value={selectedProfileId}
								onValueChange={(value) =>
									setValue('profileId', value, { shouldValidate: true })
								}
							>
								<SelectTrigger className="w-full cursor-pointer">
									<SelectValue placeholder={t('common:placeholder.selectProfile')} />
								</SelectTrigger>
								<SelectContent>
									{activeProfiles.map((profile) => (
										<SelectItem key={profile.id} value={profile.id}>
											{profile.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.profileId ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.profileId.message}
								</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('common:proxy')}</p>
							<Select
								value={selectedProxyId}
								onValueChange={(value) =>
									setValue('proxyId', value, { shouldValidate: true })
								}
								disabled={Boolean(initialProxyId)}
							>
								<SelectTrigger className="w-full cursor-pointer">
									<SelectValue placeholder={t('common:placeholder.selectProxy')} />
								</SelectTrigger>
								<SelectContent>
									{activeProxies.map((proxy) => (
										<SelectItem key={proxy.id} value={proxy.id}>
											{proxy.name} ({proxy.protocol.toUpperCase()})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.proxyId ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.proxyId.message}
								</p>
							) : null}
						</div>
						<div className="flex justify-end">
							<Button
								type="submit"
								variant="outline"
								className="cursor-pointer"
								disabled={pending || !selectedProfileId || !selectedProxyId}
							>
								<Icon
								icon={pending ? LoaderCircle : Link2}
								size={13}
								className={pending ? 'animate-spin' : ''}
							/>
							{t('common:bind')}
						</Button>
						</div>
						<div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-2">
							{boundRows.length === 0 ? (
								<p className="px-1 py-6 text-center text-xs text-muted-foreground">
									{t('common:noBound')}
								</p>
							) : (
								boundRows.map(({ profile, proxy }) => (
									<div
										key={profile.id}
										className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-2 py-2"
									>
										<div className="min-w-0">
											<p className="truncate text-xs font-medium">
												{profile.name}
											</p>
											<p className="truncate text-[11px] text-muted-foreground">
												{proxy?.name} · {proxy?.protocol.toUpperCase()}
											</p>
										</div>
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className="h-7 w-7 cursor-pointer"
											disabled={pending}
											onClick={() => setUnbindProfileId(profile.id)}
										>
											<Icon icon={Unlink2} size={12} />
										</Button>
									</div>
								))
							)}
						</div>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				open={Boolean(unbindProfileId)}
				onOpenChange={(open) => {
					if (!open) setUnbindProfileId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('proxy:unbindConfirm')}</AlertDialogTitle>
						<AlertDialogDescription>{t('proxy:unbindDesc')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button
								type="button"
								variant="ghost"
								className="cursor-pointer"
								disabled={pending}
							>
								{t('common:cancel')}
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								variant="destructive"
								className="cursor-pointer"
								disabled={pending}
								onClick={() => {
									if (unbindProfileId)
										void onUnbindProfileProxy(unbindProfileId).finally(() =>
											setUnbindProfileId(null),
										);
								}}
							>
								{pending ? <LoaderCircle className="animate-spin" /> : null}
								{t('proxy:confirmUnbind')}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
