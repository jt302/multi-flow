import type { ReactNode } from 'react';

import { Card } from '@/components/ui';

import { cn } from '@/lib/utils';

type ActionToolbarProps = {
	children: ReactNode;
	className?: string;
};

export function ActionToolbar({ children, className }: ActionToolbarProps) {
	return (
		<Card className={cn('border-border/60 bg-card/84 px-3 py-2', className)}>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</Card>
	);
}
