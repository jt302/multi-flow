import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

import { cn } from '@/lib/utils';

type DataSectionProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
};

export function DataSection({
	title,
	description,
	actions,
	children,
	className,
	contentClassName,
}: DataSectionProps) {
	return (
		<Card className={cn('border-border/60 bg-card/88 p-3', className)}>
			<CardHeader className="p-1 pb-3 shrink-0">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div className="min-w-0 flex flex-col gap-1">
						<CardTitle className="text-sm">{title}</CardTitle>
						{description ? (
							<p className="text-xs text-muted-foreground">{description}</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</div>
			</CardHeader>
			<CardContent
				className={cn(
					'p-1 pt-0 flex-1 min-h-0 overflow-y-auto',
					contentClassName,
				)}
			>
				{children}
			</CardContent>
		</Card>
	);
}
