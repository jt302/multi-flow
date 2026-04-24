import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { BookmarkDiffEntry, BookmarkDiffResult } from '@/entities/bookmark/model/types';

type DiffSectionProps = {
	title: string;
	entries: BookmarkDiffEntry[];
	colorClass: string;
	bgClass: string;
};

function DiffSection({ title, entries, colorClass, bgClass }: DiffSectionProps) {
	if (entries.length === 0) return null;

	return (
		<div className="space-y-1">
			<p className={`text-xs font-medium ${colorClass}`}>{title}</p>
			<ul className={`rounded-md border ${bgClass} divide-y divide-border/30`}>
				{entries.map((entry) => (
					<li
						key={`${entry.nodeType}-${entry.path}-${entry.title}-${entry.url ?? ''}`}
						className="px-2.5 py-1.5"
					>
						<div className="flex items-start gap-2">
							<div className="flex-1 min-w-0">
								<p className="text-xs font-medium truncate">{entry.title}</p>
								<p className="text-[10px] text-muted-foreground truncate">{entry.path}</p>
								{entry.url && (
									<p className="text-[10px] text-muted-foreground/70 truncate">{entry.url}</p>
								)}
							</div>
							<span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">
								{entry.nodeType}
							</span>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

type BookmarkDiffViewProps = {
	diff: BookmarkDiffResult;
};

export function BookmarkDiffView({ diff }: BookmarkDiffViewProps) {
	const { t } = useTranslation('bookmark');
	const isEmpty =
		diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0;

	if (isEmpty) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
				<CheckCircle2 className="h-8 w-8 text-green-500/70" />
				<p className="text-xs">{t('diff.noDiff')}</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<DiffSection
				title={t('diff.added', { count: diff.added.length })}
				entries={diff.added}
				colorClass="text-green-600"
				bgClass="border-green-200/60 bg-green-50/30 dark:bg-green-950/10"
			/>
			<DiffSection
				title={t('diff.removed', { count: diff.removed.length })}
				entries={diff.removed}
				colorClass="text-destructive"
				bgClass="border-red-200/60 bg-red-50/30 dark:bg-red-950/10"
			/>
			<DiffSection
				title={t('diff.modified', { count: diff.modified.length })}
				entries={diff.modified}
				colorClass="text-amber-600"
				bgClass="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10"
			/>
		</div>
	);
}
