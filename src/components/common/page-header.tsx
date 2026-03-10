import type { ReactNode } from 'react';

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Card,
} from '@/components/ui';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
	label: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
};

export function PageHeader({ label, title, description, actions, className }: PageHeaderProps) {
	return (
		<Card className={cn('border-border/60 bg-card/84 px-4 py-3', className)}>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0 flex flex-col gap-1">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">workspace</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									{label}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<h2 className="truncate text-lg font-semibold">{title}</h2>
					{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
				</div>
				{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
			</div>
		</Card>
	);
}
