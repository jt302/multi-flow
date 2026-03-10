import type { LucideIcon } from 'lucide-react';

import { Button, Card } from '@/components/ui';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
	title: string;
	description?: string;
	icon?: LucideIcon;
	actionLabel?: string;
	onAction?: () => void;
	className?: string;
};

export function EmptyState({
	title,
	description,
	icon: Icon,
	actionLabel,
	onAction,
	className,
}: EmptyStateProps) {
	return (
		<Card
			className={cn(
				'border-dashed border-border/70 bg-background/55 px-4 py-10 text-center',
				className,
			)}
		>
			<div className="mx-auto flex max-w-lg flex-col items-center gap-2">
				{Icon ? (
					<div className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
						<Icon className="size-4" />
					</div>
				) : null}
				<p className="text-sm font-medium">{title}</p>
				{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
				{actionLabel && onAction ? (
					<Button type="button" className="mt-2 cursor-pointer" onClick={onAction}>
						{actionLabel}
					</Button>
				) : null}
			</div>
		</Card>
	);
}
