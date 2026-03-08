import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { PlatformVisualMeta } from '../utils/platform-meta';

type PlatformMarkProps = {
	meta: PlatformVisualMeta;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
};

const SIZE_STYLES = {
	sm: {
		wrapper: 'h-9 w-9 rounded-lg',
		icon: 16,
		image: 'h-4 w-4',
	},
	md: {
		wrapper: 'h-11 w-11 rounded-xl',
		icon: 18,
		image: 'h-[18px] w-[18px]',
	},
	lg: {
		wrapper: 'h-12 w-12 rounded-xl',
		icon: 20,
		image: 'h-5 w-5',
	},
} as const;

type PlatformGlyphProps = {
	meta: PlatformVisualMeta;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
	forceLight?: boolean;
};

export function PlatformGlyph({
	meta,
	size = 'md',
	className,
	forceLight = false,
}: PlatformGlyphProps) {
	const style = SIZE_STYLES[size];

	if (meta.iconSvg) {
		const Svg = meta.iconSvg;
		return (
			<Svg
				aria-hidden="true"
				className={cn(
					'shrink-0',
					style.image,
					forceLight ? 'text-white' : meta.iconClass,
					className,
				)}
			/>
		);
	}

	if (meta.fallbackIcon) {
		return (
			<Icon
				icon={meta.fallbackIcon}
				size={style.icon}
				className={cn(forceLight ? 'text-white' : meta.iconClass, className)}
			/>
		);
	}

	return null;
}

export function PlatformMark({ meta, size = 'md', className }: PlatformMarkProps) {
	const style = SIZE_STYLES[size];

	return (
		<span
			className={cn(
				'relative inline-flex shrink-0 items-center justify-center border border-border/60 shadow-sm',
				meta.badgeClass,
				style.wrapper,
				className,
			)}
			title={meta.label}
		>
			<PlatformGlyph meta={meta} size={size} />
		</span>
	);
}
