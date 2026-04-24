import type { ReactNode } from 'react';

import { Card } from '@/components/ui';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
	label?: string;
	title?: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
};

export function PageHeader({ label: _label, actions, className }: PageHeaderProps) {
	if (!actions) return null;

	return (
		<Card className={cn('border-border/60 bg-card/84 px-4 py-2', className)}>
			<div className="flex items-center justify-end gap-2">{actions}</div>
		</Card>
	);
}
