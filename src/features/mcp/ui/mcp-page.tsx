import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
import { useMcpServersQuery } from '@/entities/mcp/model/use-mcp-query';
import type { McpServer } from '@/entities/mcp/model/types';
import { McpServerList } from './mcp-server-list';
import { McpServerEditor } from './mcp-server-editor';

export function McpPage() {
	const { t } = useTranslation('chat');
	const { defaultLayout, onLayoutChanged } = usePersistentLayout({
		id: 'mcp-layout',
	});

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const serversQuery = useMcpServersQuery();
	const servers = serversQuery.data ?? [];

	const selectedServer = servers.find((s) => s.id === selectedId) ?? null;

	const handleNew = () => {
		setIsCreating(true);
		setDialogOpen(true);
	};

	const handleSelect = (server: McpServer) => {
		setSelectedId(server.id);
		setIsCreating(false);
		setDialogOpen(true);
	};

	const handleSaved = (serverId: string) => {
		setSelectedId(serverId);
		setIsCreating(false);
		setDialogOpen(false);
	};

	const handleDeleted = (deletedId: string) => {
		if (deletedId === selectedId) {
			setSelectedId(null);
		}
		setIsCreating(false);
		setDialogOpen(false);
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
					onSelect={handleSelect}
					onNew={handleNew}
				/>
			</ResizablePanel>

			<ResizableHandle />

			<ResizablePanel defaultSize={defaultLayout?.[1] ?? 70} minSize={40}>
				<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
					{servers.length === 0 ? t('mcp.emptyHint') : t('mcp.selectOrCreate')}
				</div>
			</ResizablePanel>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setIsCreating(false);
					}
				}}
			>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>
							{isCreating ? t('mcp.createTitle') : t('mcp.editTitle')}
						</DialogTitle>
						<DialogDescription>{t('mcp.dialogDescription')}</DialogDescription>
					</DialogHeader>
					<McpServerEditor
						key={selectedServer?.id ?? 'new'}
						server={selectedServer}
						isNew={isCreating}
						onSaved={handleSaved}
						onDeleted={handleDeleted}
						onCancel={() => {
							setDialogOpen(false);
							setIsCreating(false);
						}}
					/>
				</DialogContent>
			</Dialog>
		</ResizablePanelGroup>
	);
}
