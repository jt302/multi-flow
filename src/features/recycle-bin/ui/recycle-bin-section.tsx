import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type RecycleBinSectionItem = {
	id: string;
};

type RecycleBinSectionProps<TItem extends RecycleBinSectionItem> = {
	title: string;
	items: TItem[];
	emptyText?: string;
	children: (item: TItem) => React.ReactNode;
	footer?: React.ReactNode;
};

export function RecycleBinSection<TItem extends RecycleBinSectionItem>({
	title,
	items,
	emptyText = '当前回收站为空',
	children,
	footer,
}: RecycleBinSectionProps<TItem>) {
	return (
		<Card className="p-3">
			<CardHeader className="px-1 pb-2">
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 px-1 pt-0">
				{items.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
						{emptyText}
					</div>
				) : (
					items.map((item) => children(item))
				)}
				{footer}
			</CardContent>
		</Card>
	);
}
