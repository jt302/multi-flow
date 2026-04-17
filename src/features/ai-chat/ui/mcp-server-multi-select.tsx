import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { useMcpServersQuery } from '@/entities/mcp/model/use-mcp-query';
import { cn } from '@/lib/utils';

type Props = {
	/** 当前会话中被禁用的 MCP server ID 列表 */
	disabledIds: string[];
	onSelectionChange: (disabledIds: string[]) => void;
};

export function McpServerMultiSelect({ disabledIds, onSelectionChange }: Props) {
	const { t } = useTranslation('chat');
	const [open, setOpen] = useState(false);
	const { data: servers = [] } = useMcpServersQuery();

	const enabledServers = servers.filter((s) => s.enabled);

	const toggle = (id: string) => {
		if (disabledIds.includes(id)) {
			onSelectionChange(disabledIds.filter((s) => s !== id));
		} else {
			onSelectionChange([...disabledIds, id]);
		}
	};

	const reEnable = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		onSelectionChange(disabledIds.filter((s) => s !== id));
	};

	const disabledServers = enabledServers.filter((s) => disabledIds.includes(s.id));
	const disabledCount = disabledServers.length;

	if (enabledServers.length === 0) return null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1 h-8 px-2 rounded-md border text-xs transition-colors cursor-pointer shrink-0',
						disabledCount > 0
							? 'border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10'
							: 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent',
					)}
				>
					<Plug className="size-3" />
					{disabledCount > 0
						? t('mcp.disabledCount', { count: disabledCount })
						: t('mcp.allServersActive')}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-2" align="end">
				<div className="mb-2 text-xs font-medium text-muted-foreground px-1">
					{t('mcp.sessionFilter')}
				</div>

				{/* 已禁用的 server badges */}
				{disabledServers.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-2 px-1">
						{disabledServers.map((s) => (
							<Badge key={s.id} variant="destructive" className="text-xs gap-1 pr-1 opacity-80">
								{s.name}
								<button
									type="button"
									onClick={(e) => reEnable(s.id, e)}
									className="cursor-pointer hover:opacity-70"
								>
									<X className="size-2.5" />
								</button>
							</Badge>
						))}
					</div>
				)}

				{/* server 列表 — 勾选 = 启用，取消 = 禁用 */}
				<div className="flex flex-col gap-0.5">
					{enabledServers.map((server) => {
						const active = !disabledIds.includes(server.id);
						return (
							<button
								key={server.id}
								type="button"
								onClick={() => toggle(server.id)}
								className={cn(
									'flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs w-full cursor-pointer transition-colors',
									active ? 'hover:bg-accent/50' : 'opacity-50 hover:bg-accent/50',
								)}
							>
								<span
									className={cn(
										'size-2 rounded-full shrink-0',
										active ? 'bg-green-500' : 'bg-muted-foreground/30',
									)}
								/>
								<span className="flex-1 truncate">{server.name}</span>
								<span className="text-muted-foreground text-[10px] shrink-0">
									{server.transport}
								</span>
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
