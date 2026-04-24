import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Checkbox } from '@/components/ui/checkbox';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

// ── 类型 ─────────────────────────────────────────────────────────────

interface ToolPermissionEntry {
	toolName: string;
	displayName: string;
	description: string;
	riskLevel: string;
	requireConfirmation: boolean;
}

// ── API ──────────────────────────────────────────────────────────────

async function getToolPermissions(): Promise<ToolPermissionEntry[]> {
	return tauriInvoke<ToolPermissionEntry[]>('get_tool_permissions');
}

async function setToolPermission(toolName: string, requireConfirmation: boolean): Promise<void> {
	return tauriInvoke<void>('set_tool_permission', {
		toolName,
		requireConfirmation,
	});
}

async function setAllToolPermissions(requireConfirmation: boolean): Promise<void> {
	return tauriInvoke<void>('set_all_tool_permissions', {
		requireConfirmation,
	});
}

// ── 组件 ─────────────────────────────────────────────────────────────

const QUERY_KEY = ['tool-permissions'];

export function ToolPermissionsCard() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();

	const { data: permissions = [] } = useQuery({
		queryKey: QUERY_KEY,
		queryFn: getToolPermissions,
	});

	const toggleMutation = useMutation({
		mutationFn: ({
			toolName,
			requireConfirmation,
		}: {
			toolName: string;
			requireConfirmation: boolean;
		}) => setToolPermission(toolName, requireConfirmation),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
		onError: (e) => {
			toast.error(t('common:errors.generic', { message: String(e) }));
		},
	});

	const batchMutation = useMutation({
		mutationFn: setAllToolPermissions,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
		onError: (e) => {
			toast.error(t('common:errors.generic', { message: String(e) }));
		},
	});

	const allConfirm = permissions.every((p) => p.requireConfirmation);
	const noneConfirm = permissions.every((p) => !p.requireConfirmation);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<div className="flex items-center gap-2">
					<ShieldAlert className="h-5 w-5 text-destructive" />
					<div>
						<CardTitle className="text-base">{t('settings:toolPermissions.title')}</CardTitle>
						<p className="text-xs text-muted-foreground mt-0.5">
							{t('settings:toolPermissions.desc')}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={allConfirm || batchMutation.isPending}
						onClick={() => batchMutation.mutate(true)}
					>
						{t('settings:toolPermissions.allConfirm')}
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={noneConfirm || batchMutation.isPending}
						onClick={() => batchMutation.mutate(false)}
					>
						{t('settings:toolPermissions.allSkip')}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="divide-y divide-border rounded-md border">
					{permissions.map((entry) => (
						<div key={entry.toolName} className="flex items-center justify-between px-3 py-3">
							<div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-4">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">{entry.displayName}</span>
									<code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
										{entry.toolName}
									</code>
								</div>
								{entry.description && (
									<p className="text-xs text-muted-foreground">{entry.description}</p>
								)}
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<span className="text-xs text-muted-foreground whitespace-nowrap">
									{t('settings:toolPermissions.requireConfirmation')}
								</span>
								<Checkbox
									className="cursor-pointer"
									checked={entry.requireConfirmation}
									onCheckedChange={(checked: boolean) =>
										toggleMutation.mutate({
											toolName: entry.toolName,
											requireConfirmation: !!checked,
										})
									}
									disabled={toggleMutation.isPending}
								/>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
