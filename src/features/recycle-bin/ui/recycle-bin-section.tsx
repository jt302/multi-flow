import type { ReactNode } from 'react';

import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { DataSection } from '@/components/common';

type RecycleBinSectionItem = {
	id: string;
};

type RecycleBinSectionProps<TItem extends RecycleBinSectionItem> = {
	title: string;
	items: TItem[];
	emptyText?: string;
	children: (item: TItem) => ReactNode;
	footer?: ReactNode;
};

export function RecycleBinSection<TItem extends RecycleBinSectionItem>({
	title,
	items,
	emptyText = '当前回收站为空',
	children,
	footer,
}: RecycleBinSectionProps<TItem>) {
	return (
		<DataSection title={title} contentClassName="p-1 pt-0">
				{items.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
						{emptyText}
					</div>
				) : (
					<div className="overflow-hidden rounded-xl border border-border/70">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/20 hover:bg-muted/20">
									<TableHead>名称</TableHead>
									<TableHead className="w-[280px]">详情</TableHead>
									<TableHead className="w-[220px] text-right">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>{items.map((item) => children(item))}</TableBody>
						</Table>
					</div>
				)}
				{footer}
		</DataSection>
	);
}
