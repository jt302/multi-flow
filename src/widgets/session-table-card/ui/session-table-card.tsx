import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, Icon } from '@/components/ui';
import { getStatusVariant } from '@/shared/lib/status';

import type { SessionTableCardProps } from '@/app/model/workspace-types';
import { cn } from '@/lib/utils';

export function SessionTableCard({
	title,
	rows,
	className,
}: SessionTableCardProps & { className?: string }) {
	const { t } = useTranslation('common');
	return (
		<Card className={cn('min-w-0 p-3', className)}>
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-sm font-semibold">{title}</h2>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-xs text-muted-foreground"
				>
					<Icon icon={Activity} size={12} />
					{t('refresh')}
				</Button>
			</div>

			<div className="overflow-hidden overflow-y-auto rounded-xl border border-border/70 flex-1 min-h-0">
				{rows.map((row, index) => (
					<div
						key={row.name}
						className={`grid grid-cols-[minmax(0,1fr)_110px_110px_120px] items-center gap-3 px-3 py-3 text-sm ${
							index < rows.length - 1 ? 'border-b border-border/70' : ''
						}`}
					>
						<div className="min-w-0">
							<p className="truncate font-medium">{row.name}</p>
							<p className="truncate text-xs text-muted-foreground">
								{row.group}
							</p>
						</div>
						<p className="text-xs text-muted-foreground">{row.geo}</p>
						<p className="text-xs text-muted-foreground">{row.last}</p>
						<div className="text-right">
							<Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
						</div>
					</div>
				))}
			</div>
		</Card>
	);
}
