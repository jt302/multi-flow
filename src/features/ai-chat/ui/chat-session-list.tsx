import { formatDistanceToNow } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { ChatSession } from '@/entities/chat/model/types';
import { cn } from '@/lib/utils';

type Props = {
	sessions: ChatSession[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onCreate: () => void;
	onDelete: (id: string) => void;
};

export const ChatSessionList = memo(function ChatSessionList({
	sessions,
	activeId,
	onSelect,
	onCreate,
	onDelete,
}: Props) {
	const { t, i18n } = useTranslation('chat');
	const dateLocale = i18n.language === 'zh-CN' ? zhCN : enUS;
	return (
		<div className="flex h-full flex-col">
			<div className="p-3 border-b">
				<Button type="button" className="w-full gap-2" size="sm" onClick={onCreate}>
					<MessageSquarePlus className="size-4" />
					{t('newChat')}
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto overflow-x-hidden">
				<div className="p-2 space-y-1 w-full">
					{sessions.map((s) => (
						<div
							key={s.id}
							role="button"
							tabIndex={0}
							onClick={() => onSelect(s.id)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onSelect(s.id);
								}
							}}
							className={cn(
								'group w-full min-w-0 overflow-hidden rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer',
								s.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
							)}
						>
							<div className="flex items-start justify-between gap-2 min-w-0">
								<span className="truncate font-medium leading-5 min-w-0">
									{s.title ?? t('defaultTitle')}
								</span>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDelete(s.id);
									}}
									className="shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer text-muted-foreground hover:text-destructive"
								>
									<Trash2 className="size-3.5" />
								</button>
							</div>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								{formatDistanceToNow(s.updatedAt * 1000, {
									addSuffix: true,
									locale: dateLocale,
								})}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
});
