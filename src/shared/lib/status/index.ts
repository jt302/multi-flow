import i18next from 'i18next';
import type { VariantProps } from 'class-variance-authority';

import { badgeVariants } from '@/components/ui';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export function getStatusVariant(status: string): BadgeVariant {
	if (status === i18next.t('common:running')) {
		return 'default';
	}
	if (status === i18next.t('common:warning')) {
		return 'destructive';
	}
	return 'secondary';
}
