import { cn } from '@/lib/utils';

type PageLoadingStateProps = {
	label: string;
	className?: string;
};

export function PageLoadingState({ label, className }: PageLoadingStateProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			className={cn(
				'flex min-h-40 items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-muted-foreground',
				className,
			)}
		>
			<div className="flex items-center gap-2 text-sm">
				<div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				<span>{label}</span>
			</div>
		</div>
	);
}
