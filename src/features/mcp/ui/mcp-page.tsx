import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
import { useMcpServersQuery } from '@/entities/mcp/model/use-mcp-query';
import type { McpServer } from '@/entities/mcp/model/types';
import { useCreateMcpServer } from '../model/use-mcp-mutations';
import { McpServerList } from './mcp-server-list';
import { McpServerEditor } from './mcp-server-editor';

export function McpPage() {
	const { t } = useTranslation('chat');
	const { defaultLayout, onLayoutChanged } = usePersistentLayout({
		id: 'mcp-layout',
	});

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const serversQuery = useMcpServersQuery();
	const servers = serversQuery.data ?? [];
	const createServer = useCreateMcpServer();

	const selectedServer = servers.find((s) => s.id === selectedId) ?? null;

	const handleNew = () => {
		createServer.mutate(
			{
				name: t('mcp.newServerName'),
				transport: 'stdio',
			},
			{
				onSuccess: (server) => {
					setSelectedId(server.id);
				},
				onError: (err) => toast.error(String(err)),
			},
		);
	};

	const handleDeleted = () => {
		setSelectedId(null);
	};

	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="h-full"
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel defaultSize={defaultLayout?.[0] ?? 30} minSize={20} maxSize={40}>
				<McpServerList
					servers={servers}
					selectedId={selectedId}
					onSelect={(s: McpServer) => setSelectedId(s.id)}
					onNew={handleNew}
				/>
			</ResizablePanel>

			<ResizableHandle withHandle />

			<ResizablePanel defaultSize={defaultLayout?.[1] ?? 70} minSize={40}>
				{selectedServer ? (
					<McpServerEditor
						key={selectedServer.id}
						server={selectedServer}
						onDeleted={handleDeleted}
					/>
				) : (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						{servers.length === 0 ? t('mcp.emptyHint') : t('mcp.selectOrCreate')}
					</div>
				)}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
