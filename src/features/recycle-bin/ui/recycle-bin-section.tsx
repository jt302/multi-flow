import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
	emptyText,
	children,
	footer,
}: RecycleBinSectionProps<TItem>) {
	const { t } = useTranslation('recycle');
	return (
		<DataSection title={title} contentClassName="p-1 pt-0">
			{items.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
					{emptyText ?? t('emptyBin')}
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-border/70">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/20 hover:bg-muted/20">
								<TableHead>{t('name')}</TableHead>
								<TableHead className="w-[280px]">{t('detail')}</TableHead>
								<TableHead className="w-[220px] text-right">
									{t('action')}
								</TableHead>
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
