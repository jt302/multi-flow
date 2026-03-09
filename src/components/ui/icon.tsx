import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type IconProps = {
	icon: LucideIcon;
	size?: number;
	className?: string;
	strokeWidth?: number;
};

function Icon({ icon: Lucide, size = 16, className, strokeWidth = 2 }: IconProps) {
	return <Lucide size={size} strokeWidth={strokeWidth} className={cn('shrink-0', className)} />;
}

export { Icon };
