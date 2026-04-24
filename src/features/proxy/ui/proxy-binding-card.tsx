import { zodResolver } from '@hookform/resolvers/zod';
import i18next from 'i18next';
import { Link2, Unlink2 } from 'lucide-react';
import { useEffect } from 'react';
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import type { ProfileItem, ProfileProxyBindingMap } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

const proxyBindingFormSchema = z.object({
	profileId: z.string().trim().min(1, i18next.t('proxy:validation.selectProfile')),
	proxyId: z.string().trim().min(1, i18next.t('proxy:validation.selectProxy')),
});

type ProxyBindingFormValues = z.infer<typeof proxyBindingFormSchema>;

type ProxyBindingCardProps = {
	pending: boolean;
	profiles: ProfileItem[];
	activeProxies: ProxyItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	onBindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	onUnbindProfileProxy: (profileId: string) => Promise<void>;
};

export function ProxyBindingCard({
	pending,
	profiles,
	activeProxies,
	profileProxyBindings,
	onBindProfileProxy,
	onUnbindProfileProxy,
}: ProxyBindingCardProps) {
	const { t } = useTranslation(['common', 'proxy']);

	const {
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<ProxyBindingFormValues>({
		resolver: zodResolver(proxyBindingFormSchema),
		defaultValues: {
			profileId: '',
			proxyId: '',
		},
	});

	const selectedProfileId = watch('profileId');
	const selectedProxyId = watch('proxyId');
	const activeProfiles = profiles.filter((item) => item.lifecycle === 'active');
	const boundRows = activeProfiles
		.filter((profile) => profileProxyBindings[profile.id])
		.map((profile) => ({
			profile,
			proxy: activeProxies.find((proxy) => proxy.id === profileProxyBindings[profile.id]),
		}))
		.filter((item) => Boolean(item.proxy));

	useEffect(() => {
		if (!selectedProfileId || !activeProfiles.some((item) => item.id === selectedProfileId)) {
			setValue('profileId', activeProfiles[0]?.id ?? '', { shouldValidate: true });
		}
	}, [activeProfiles, selectedProfileId, setValue]);

	useEffect(() => {
		if (!selectedProxyId || !activeProxies.some((item) => item.id === selectedProxyId)) {
			setValue('proxyId', activeProxies[0]?.id ?? '', { shouldValidate: true });
		}
	}, [activeProxies, selectedProxyId, setValue]);

	return (
		<Card className="p-4">
			<CardHeader className="p-0">
				<CardTitle className="text-sm">{t('proxy:binding')}</CardTitle>
			</CardHeader>
			<CardContent className="p-0 pt-3">
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (values) => {
						await onBindProfileProxy(values.profileId, values.proxyId);
					})}
				>
					<div>
						<Select
							value={selectedProfileId}
							onValueChange={(value) => setValue('profileId', value, { shouldValidate: true })}
						>
							<SelectTrigger className="w-full">
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
							<p className="mt-1 text-xs text-destructive">{errors.profileId.message}</p>
						) : null}
					</div>
					<div>
						<Select
							value={selectedProxyId}
							onValueChange={(value) => setValue('proxyId', value, { shouldValidate: true })}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t('common:placeholder.selectProxy')} />
							</SelectTrigger>
							<SelectContent>
								{activeProxies.map((proxy) => (
									<SelectItem key={proxy.id} value={proxy.id}>
										{proxy.name} ({proxy.protocol})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.proxyId ? (
							<p className="mt-1 text-xs text-destructive">{errors.proxyId.message}</p>
						) : null}
					</div>
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="submit"
							variant="outline"
							disabled={pending || !selectedProfileId || !selectedProxyId}
						>
							<Icon icon={Link2} size={13} />
							{t('common:bind')}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={pending || !selectedProfileId}
							onClick={() => void onUnbindProfileProxy(selectedProfileId)}
						>
							<Icon icon={Unlink2} size={13} />
							{t('common:unbind')}
						</Button>
					</div>
					<div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 p-2">
						{boundRows.length === 0 ? (
							<p className="px-1 py-6 text-center text-xs text-muted-foreground">
								{t('common:noBound')}
							</p>
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
										onClick={() => void onUnbindProfileProxy(profile.id)}
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
	);
}
