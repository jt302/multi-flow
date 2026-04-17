import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { McpServer } from '@/entities/mcp/model/types';
import { useEnableMcpServer, useDisableMcpServer } from '../model/use-mcp-mutations';

type Props = {
	servers: McpServer[];
	selectedId: string | null;
	onSelect: (server: McpServer) => void;
	onNew: () => void;
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
	running: 'default',
	error: 'destructive',
	starting: 'secondary',
	idle: 'outline',
};

export function McpServerList({ servers, selectedId, onSelect, onNew }: Props) {
	const { t } = useTranslation('chat');
	const enableServer = useEnableMcpServer();
	const disableServer = useDisableMcpServer();

	const toggleEnabled = (server: McpServer, e: React.MouseEvent) => {
		e.stopPropagation();
		if (server.enabled) {
			disableServer.mutate(server.id);
		} else {
			enableServer.mutate(server.id);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
				<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					{t('mcp.servers')}
				</span>
				<Button size="icon" variant="ghost" className="size-6 cursor-pointer" onClick={onNew}>
					<Plus className="size-3.5" />
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto">
				{servers.length === 0 && (
					<p className="px-3 py-4 text-xs text-muted-foreground text-center">{t('mcp.empty')}</p>
				)}
				{servers.map((server) => (
					<button
						key={server.id}
						type="button"
						onClick={() => onSelect(server)}
						className={cn(
							'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors cursor-pointer',
							selectedId === server.id && 'bg-accent',
						)}
					>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{server.name}</p>
							<div className="flex items-center gap-1.5 mt-0.5">
								<Badge variant={statusVariant[server.lastStatus] ?? 'outline'} className="text-xs h-4 px-1">
									{t(`mcp.status.${server.lastStatus}`)}
								</Badge>
								<span className="text-xs text-muted-foreground">{server.transport}</span>
							</div>
						</div>
						<Switch
							checked={server.enabled}
							onCheckedChange={() => {}}
							onClick={(e) => toggleEnabled(server, e)}
							className="shrink-0 cursor-pointer"
						/>
					</button>
				))}
			</div>
		</div>
	);
}
