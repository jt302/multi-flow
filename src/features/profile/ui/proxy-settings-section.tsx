import { CheckIcon, Info, MapPin, ShieldOff } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
	Badge,
	Select,
	SelectContent,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/shared/lib/country-flag';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type ProxySettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	availableProxies: ProxyItem[];
	proxyId: string;
};

function formatGeo(proxy: ProxyItem): string {
	const parts = [proxy.city, proxy.region, proxy.country]
		.map((p) => p.trim())
		.filter(Boolean);
	return parts.join(', ');
}

type StatusVariant = 'secondary' | 'destructive' | 'warning' | 'outline';

type StatusMeta = {
	variant: StatusVariant;
	labelKey: string;
	badgeClassName?: string;
	dotClassName: string;
};

function resolveStatus(raw: string): StatusMeta {
	const value = raw.trim().toLowerCase();
	if (value === 'ok') {
		return {
			variant: 'outline',
			labelKey: 'proxySettings.statusOk',
			badgeClassName:
				'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
			dotClassName: 'bg-emerald-500',
		};
	}
	if (value === 'error') {
		return {
			variant: 'destructive',
			labelKey: 'proxySettings.statusError',
			dotClassName: 'bg-red-500',
		};
	}
	if (value === 'unsupported') {
		return {
			variant: 'warning',
			labelKey: 'proxySettings.statusUnsupported',
			dotClassName: 'bg-amber-500',
		};
	}
	return {
		variant: 'secondary',
		labelKey: 'proxySettings.statusUnknown',
		dotClassName: 'bg-muted-foreground/40',
	};
}

const itemClassName =
	'group relative flex w-full cursor-pointer select-none items-center gap-3 rounded-md py-2 pr-8 pl-2.5 outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

function FlagTile({ flag, className }: { flag: string; className?: string }) {
	return (
		<span
			className={cn(
				'flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-muted to-muted/40 ring-1 ring-border/50',
				className,
			)}
			aria-hidden
		>
			<span className="leading-none">{flag || '🌐'}</span>
		</span>
	);
}

function ProxySelectItem({ item }: { item: ProxyItem }) {
	const flag = countryCodeToFlag(item.country);
	const geo = formatGeo(item);
	const ip = item.exitIp.trim();
	const status = resolveStatus(item.checkStatus);

	return (
		<SelectPrimitive.Item value={item.id} className={itemClassName}>
			<span className="absolute right-2 top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>

			<FlagTile flag={flag} className="h-9 w-9 text-xl" />

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<SelectPrimitive.ItemText>
					<span className="flex items-center gap-1.5">
						<span className="truncate text-sm font-semibold">{item.name}</span>
						<span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
							{item.protocol}
						</span>
					</span>
				</SelectPrimitive.ItemText>
				<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
					<span className="font-mono">
						{ip || `${item.host}:${item.port}`}
					</span>
					{geo ? (
						<>
							<span
								className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40"
								aria-hidden
							/>
							<span className="flex min-w-0 items-center gap-0.5 truncate">
								<MapPin className="size-3 shrink-0" />
								<span className="truncate">{geo}</span>
							</span>
						</>
					) : null}
				</div>
			</div>

			<span
				className={cn(
					'mr-1 h-2 w-2 shrink-0 rounded-full ring-2 ring-background',
					status.dotClassName,
				)}
				aria-hidden
			/>
		</SelectPrimitive.Item>
	);
}

function NoProxyItem({ label }: { label: string }) {
	return (
		<SelectPrimitive.Item value="__none__" className={itemClassName}>
			<span className="absolute right-2 top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<span
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground ring-1 ring-border/50"
				aria-hidden
			>
				<ShieldOff className="size-4" />
			</span>
			<SelectPrimitive.ItemText>
				<span className="text-sm font-medium">{label}</span>
			</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

export function ProxySettingsSection({
	form,
	availableProxies,
	proxyId,
}: ProxySettingsSectionProps) {
	const { t } = useTranslation('profile');
	const { setValue } = form;

	const selectedProxy =
		proxyId && proxyId !== '__none__'
			? availableProxies.find((p) => p.id === proxyId) ?? null
			: null;

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title={t('proxySettings.title')} description={t('proxySettings.desc')} />
			<Select
				value={proxyId || '__none__'}
				onValueChange={(value) => setValue('proxyId', value, { shouldDirty: true })}
			>
				<SelectTrigger className="h-auto min-h-10 py-1.5">
					<SelectValue placeholder={t('proxySettings.noProxy')} />
				</SelectTrigger>
				<SelectContent className="min-w-[360px] p-1.5">
					<NoProxyItem label={t('proxySettings.noProxy')} />
					{availableProxies.length ? (
						<div className="my-1 h-px bg-border/60" />
					) : null}
					{availableProxies.map((item) => (
						<ProxySelectItem key={item.id} item={item} />
					))}
				</SelectContent>
			</Select>

			{selectedProxy ? (
				<ProxyDetailCard proxy={selectedProxy} hint={t('proxySettings.proxyHint')} />
			) : null}
		</div>
	);
}

function ProxyDetailCard({ proxy, hint }: { proxy: ProxyItem; hint: string }) {
	const { t } = useTranslation('profile');
	const flag = countryCodeToFlag(proxy.country);
	const geo = formatGeo(proxy);
	const status = resolveStatus(proxy.checkStatus);
	const hasCoords = proxy.latitude !== null && proxy.longitude !== null;
	const ip = proxy.exitIp.trim();

	return (
		<div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-muted/30 via-background to-background shadow-sm">
			<div className="flex items-start justify-between gap-3 p-4 pb-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="relative shrink-0">
						<FlagTile flag={flag} className="h-12 w-12 text-3xl shadow-sm" />
						<span
							className={cn(
								'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background',
								status.dotClassName,
							)}
							aria-hidden
						/>
					</div>
					<div className="min-w-0 space-y-1">
						<div className="truncate text-sm font-semibold leading-tight">
							{geo || t('proxySettings.notChecked')}
						</div>
						<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
							<span className="rounded bg-muted/70 px-1.5 py-px font-mono font-bold uppercase tracking-[0.08em]">
								{proxy.protocol}
							</span>
							<span className="font-mono">
								{proxy.host}:{proxy.port}
							</span>
						</div>
					</div>
				</div>
				<Badge variant={status.variant} className={cn('shrink-0', status.badgeClassName)}>
					{t(status.labelKey)}
				</Badge>
			</div>

			<div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
				<InfoField label={t('proxySettings.exitIp')} value={ip} mono />
				<InfoField
					label={t('proxySettings.coords')}
					value={
						hasCoords
							? `${proxy.latitude!.toFixed(4)}, ${proxy.longitude!.toFixed(4)}`
							: ''
					}
					mono
				/>
			</div>

			<div className="flex items-start gap-1.5 border-t border-border/60 bg-muted/15 px-4 py-2.5 text-[11px] text-muted-foreground">
				<Info className="mt-0.5 size-3 shrink-0" />
				<span className="leading-relaxed">{hint}</span>
			</div>
		</div>
	);
}

function InfoField({
	label,
	value,
	mono,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	const { t } = useTranslation('profile');
	const display = value.trim() || t('proxySettings.notChecked');
	const empty = !value.trim();
	return (
		<div className="px-4 py-2.5">
			<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
				{label}
			</div>
			<div
				className={cn(
					'mt-1 truncate text-xs',
					mono && !empty && 'font-mono',
					empty && 'text-muted-foreground italic',
				)}
			>
				{display}
			</div>
		</div>
	);
}
