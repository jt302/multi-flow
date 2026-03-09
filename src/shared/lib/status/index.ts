import type { VariantProps } from 'class-variance-authority';

import { badgeVariants } from '@/components/ui';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export function getStatusVariant(status: string): BadgeVariant {
	if (status === '运行中') {
		return 'default';
	}
	if (status === '告警') {
		return 'destructive';
	}
	return 'secondary';
}
