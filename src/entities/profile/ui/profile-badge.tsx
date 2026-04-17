import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { resolvePlatformMeta } from '@/entities/profile/lib/profile-list';
import { PlatformGlyph } from './platform-mark';

export type ProfileBadgeProps = {
	profileId?: string;
	profileName?: string;
	size?: 'sm' | 'md';
	showIcon?: boolean;
	showName?: boolean;
	showColor?: boolean;
	className?: string;
};

/**
 * 显示环境标识的小徽章，自动从 profiles 缓存中查找名称与图标。
 * 若找不到 profile，fallback 顺序：profileName → profileId[:8] → i18n unknown。
 */
export function ProfileBadge({
	profileId,
	profileName,
	size = 'sm',
	showIcon = true,
	showName = true,
	showColor = true,
	className,
}: ProfileBadgeProps) {
	const { t } = useTranslation('common');
	const { data: profiles = [] } = useProfilesQuery();
	const profile = profileId ? profiles.find((p) => p.id === profileId) : undefined;

	const displayName =
		profile?.name ??
		profileName ??
		(profileId ? profileId.slice(0, 8) : t('runContext.unknown'));
	const meta = profile ? resolvePlatformMeta(profile) : undefined;
	const bgColor = profile?.settings?.basic?.browserBgColor;

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-muted/60 text-foreground/80 shrink-0',
				size === 'sm' ? 'text-[11px]' : 'text-xs',
				className,
			)}
			title={t('runContext.fromProfile', { name: displayName })}
		>
			{showColor && bgColor && (
				<span
					className="h-2 w-2 rounded-full shrink-0"
					style={{ backgroundColor: bgColor }}
				/>
			)}
			{showIcon && meta && (
				<PlatformGlyph
					meta={meta}
					size="sm"
					className="!w-3 !h-3 shrink-0 opacity-80"
				/>
			)}
			{showName && <span className="truncate max-w-[6rem]">{displayName}</span>}
		</span>
	);
}
