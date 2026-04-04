import i18next from 'i18next';

import { TerminalSquare, type LucideIcon } from 'lucide-react';
import type { FC, SVGProps } from 'react';

import AndroidIcon from '@/assets/icon/android.svg?react';
import AppleIcon from '@/assets/icon/apple.svg?react';
import IPhoneIcon from '@/assets/icon/iphone.svg?react';
import LinuxIcon from '@/assets/icon/linux.svg?react';
import WindowsIcon from '@/assets/icon/windows.svg?react';

type SvgComponent = FC<SVGProps<SVGSVGElement>>;

export type PlatformVisualMeta = {
	value: string;
	label: string;
	iconSvg?: SvgComponent;
	fallbackIcon?: LucideIcon;
	code: string;
	hint: string;
	badgeClass: string;
	iconClass: string;
};

export const PLATFORM_OPTIONS: PlatformVisualMeta[] = [
	{
		value: 'macos',
		label: 'macOS',
		iconSvg: AppleIcon,
		fallbackIcon: TerminalSquare,
		code: 'MAC',
		hint: i18next.t('platform:desktopApple'),
		badgeClass: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
		iconClass: 'text-zinc-700 dark:text-zinc-200',
	},
	{
		value: 'windows',
		label: 'Windows',
		iconSvg: WindowsIcon,
		fallbackIcon: TerminalSquare,
		code: 'WIN',
		hint: i18next.t('platform:desktopMicrosoft'),
		badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
		iconClass: 'text-sky-600 dark:text-sky-400',
	},
	{
		value: 'linux',
		label: 'Linux',
		iconSvg: LinuxIcon,
		fallbackIcon: TerminalSquare,
		code: 'LNX',
		hint: i18next.t('platform:desktopLinux'),
		badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		iconClass: 'text-amber-600 dark:text-amber-400',
	},
	{
		value: 'android',
		label: 'Android',
		iconSvg: AndroidIcon,
		fallbackIcon: TerminalSquare,
		code: 'AND',
		hint: i18next.t('platform:mobileTouch'),
		badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		iconClass: 'text-emerald-600 dark:text-emerald-400',
	},
	{
		value: 'ios',
		label: 'iOS',
		iconSvg: IPhoneIcon,
		fallbackIcon: TerminalSquare,
		code: 'iOS',
		hint: 'iPhone / iPad',
		badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
		iconClass: 'text-slate-600 dark:text-slate-300',
	},
];

export function getPlatformMeta(platform?: string | null): PlatformVisualMeta {
	const normalized = platform?.trim().toLowerCase();
	if (!normalized) {
			return {
				value: 'system',
				label: i18next.t('platform:currentSystem'),
				fallbackIcon: TerminalSquare,
				code: 'SYS',
				hint: i18next.t('platform:hostPlatform'),
				badgeClass: 'bg-muted text-muted-foreground',
				iconClass: 'text-muted-foreground',
			};
	}

	const matched = PLATFORM_OPTIONS.find((item) => normalized.includes(item.value));
	if (matched) {
		return matched;
	}

	if (normalized.includes('win')) {
		return PLATFORM_OPTIONS[1];
	}
	if (normalized.includes('iphone') || normalized.includes('ipad')) {
		return PLATFORM_OPTIONS[4];
	}
	if (normalized.includes('mac')) {
		return PLATFORM_OPTIONS[0];
	}

	return {
		value: normalized,
		label: platform?.trim() || i18next.t('common:notSet'),
		fallbackIcon: TerminalSquare,
		code: 'SYS',
		hint: i18next.t('platform:unknown'),
		badgeClass: 'bg-muted text-muted-foreground',
		iconClass: 'text-muted-foreground',
	};
}
