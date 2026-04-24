import { BadgeCheck, ChevronRight, Server, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { McpServer } from '@/entities/mcp/model/types';
import { cn } from '@/lib/utils';
import { useDisableMcpServer, useEnableMcpServer } from '../model/use-mcp-mutations';

type Props = {
	servers: McpServer[];
	isLoading: boolean;
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

function buildServerSummary(server: McpServer, t: (key: string) => string) {
	const error = server.lastError?.trim();
	if (error) return error;

	if (server.transport === 'stdio') {
		return server.command?.trim() || t('mcp.commandSummaryFallback');
	}

	return server.url?.trim() || t('mcp.urlSummaryFallback');
}

export function McpServerList({ servers, isLoading, selectedId, onSelect }: Props) {
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

	if (isLoading) {
		return (
			<div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
				{t('mcp.allServersActive')}...
			</div>
		);
	}

	if (servers.length === 0) {
		return (
			<div className="flex h-full min-h-52 items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
				{t('mcp.empty')}
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto rounded-xl border border-border/70 bg-card p-3 shadow-sm">
			<div className="space-y-2">
				{servers.map((server) => {
					const summary = buildServerSummary(server, t);
					const summaryIsError = Boolean(server.lastError?.trim());

					return (
						<div
							key={server.id}
							onClick={() => onSelect(server)}
							className={cn(
								'rounded-xl border border-border/70 bg-card px-4 py-4 transition-colors hover:bg-accent/30',
								selectedId === server.id && 'border-primary/35 bg-accent/40',
							)}
						>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<Server className="size-4" />
								</div>
								<div className="min-w-0 flex-1 space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<div className="truncate text-sm font-medium text-foreground">
											{server.name}
										</div>
										<Badge
											variant={statusVariant[server.lastStatus] ?? 'outline'}
											className="text-[11px]"
										>
											{t(`mcp.status.${server.lastStatus}`)}
										</Badge>
										<span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
											{server.transport}
										</span>
										{server.enabled ? (
											<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
												<BadgeCheck className="size-3" />
												{t('mcp.enabledBadge')}
											</span>
										) : (
											<span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
												{t('mcp.disabledBadge')}
											</span>
										)}
									</div>
									<div
										className={cn(
											'line-clamp-2 text-xs text-muted-foreground',
											summaryIsError && 'text-destructive',
										)}
									>
										{summary}
									</div>
									{summaryIsError ? (
										<div className="inline-flex items-center gap-1 text-[11px] text-destructive">
											<TriangleAlert className="size-3" />
											{t('mcp.errorSummaryBadge')}
										</div>
									) : null}
								</div>
								<div className="flex items-center gap-2">
									<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
										<span className="text-xs text-muted-foreground">{t('mcp.fieldEnabled')}</span>
										<Switch
											checked={server.enabled}
											onCheckedChange={() => {}}
											onClick={(e) => toggleEnabled(server, e)}
											className="cursor-pointer"
										/>
									</div>
									<ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
