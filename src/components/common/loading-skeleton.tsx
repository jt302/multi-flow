import { useMemo } from 'react';

import { Skeleton } from '@/components/ui';

import { cn } from '@/lib/utils';

type LoadingSkeletonProps = {
	rows?: number;
	className?: string;
};

export function LoadingSkeleton({ rows = 4, className }: LoadingSkeletonProps) {
	const skeletonKeys = useMemo(
		() => Array.from({ length: rows }, (_unused, rowNumber) => `loading-skeleton-row-${rowNumber}`),
		[rows],
	);

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			{skeletonKeys.map((rowKey) => (
				<Skeleton key={rowKey} className="h-10 w-full" />
			))}
		</div>
	);
}
