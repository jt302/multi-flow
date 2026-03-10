import { Skeleton } from '@/components/ui';

import { cn } from '@/lib/utils';

type LoadingSkeletonProps = {
	rows?: number;
	className?: string;
};

export function LoadingSkeleton({ rows = 4, className }: LoadingSkeletonProps) {
	return (
		<div className={cn('flex flex-col gap-2', className)}>
			{Array.from({ length: rows }).map((_, index) => (
				<Skeleton key={index} className="h-10 w-full" />
			))}
		</div>
	);
}
