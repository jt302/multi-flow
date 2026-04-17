import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useMcpToolsQuery } from '@/entities/mcp/model/use-mcp-query';

type Props = {
	serverId: string | null;
};

export function McpToolsPreview({ serverId }: Props) {
	const { t } = useTranslation('chat');
	const [expanded, setExpanded] = useState(true);
	const toolsQuery = useMcpToolsQuery(serverId);
	const tools = toolsQuery.data ?? [];

	if (!serverId) return null;

	return (
		<div className="border rounded-md overflow-hidden">
			<button
				type="button"
				onClick={() => setExpanded((e) => !e)}
				className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted text-sm font-medium cursor-pointer"
			>
				{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
				<Wrench className="size-3.5" />
				<span>{t('mcp.tools')} ({tools.length})</span>
			</button>

			{expanded && (
				<div className="divide-y max-h-48 overflow-y-auto">
					{toolsQuery.isPending && (
						<p className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.loadingTools')}</p>
					)}
					{toolsQuery.isError && (
						<p className="px-3 py-2 text-xs text-destructive">{t('mcp.toolsError')}</p>
					)}
					{tools.map((tool) => (
						<div key={tool.name} className="px-3 py-1.5">
							<p className="text-xs font-mono font-medium truncate">{tool.originalName}</p>
							{tool.description && (
								<p className="text-xs text-muted-foreground truncate mt-0.5">{tool.description}</p>
							)}
						</div>
					))}
					{!toolsQuery.isPending && !toolsQuery.isError && tools.length === 0 && (
						<p className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.noTools')}</p>
					)}
				</div>
			)}
		</div>
	);
}
