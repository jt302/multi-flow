import { LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { McpServer } from '@/entities/mcp/model/types';
import { useMcpServersQuery } from '@/entities/mcp/model/use-mcp-query';
import { McpServerEditor } from './mcp-server-editor';
import { McpServerList } from './mcp-server-list';

export function McpPage() {
	const { t } = useTranslation('chat');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const serversQuery = useMcpServersQuery();
	const servers = serversQuery.data ?? [];

	const selectedServer = servers.find((s) => s.id === selectedId) ?? null;

	const handleNew = () => {
		setSelectedId(null);
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

	const handleRefresh = () => {
		void serversQuery.refetch();
	};

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm">
				<div className="space-y-1">
					<h1 className="text-base font-semibold text-foreground">{t('mcp.allServersActive')}</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">{t('mcp.pageDescription')}</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={handleRefresh}
						className="cursor-pointer"
					>
						{serversQuery.isFetching ? (
							<LoaderCircle className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						{serversQuery.isFetching ? t('mcp.refreshPending') : t('mcp.refreshAction')}
					</Button>
					<Button type="button" onClick={handleNew} className="cursor-pointer">
						<Plus className="h-4 w-4" />
						{t('mcp.createTitle')}
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<McpServerList
					servers={servers}
					isLoading={serversQuery.isLoading}
					selectedId={selectedId}
					onSelect={handleSelect}
					onNew={handleNew}
				/>
			</div>
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
						<DialogTitle>{isCreating ? t('mcp.createTitle') : t('mcp.editTitle')}</DialogTitle>
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
		</div>
	);
}
