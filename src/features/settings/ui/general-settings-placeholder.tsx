import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tauriInvoke } from '@/shared/api/tauri-invoke';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function GeneralSettingsPlaceholder() {
	const queryClient = useQueryClient();
	const loggingQuery = useQuery({
		queryKey: ['chromium-logging-enabled'],
		queryFn: () => tauriInvoke<boolean>('read_chromium_logging_enabled'),
	});

	const toggleLogging = useMutation({
		mutationFn: (enabled: boolean) =>
			tauriInvoke<void>('update_chromium_logging_enabled', { enabled }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['chromium-logging-enabled'] });
		},
	});

	const loggingEnabled = loggingQuery.data ?? true;

	return (
		<Card className="border-border/40 bg-card/60 backdrop-blur-md">
			<CardHeader>
				<CardTitle className="text-base">通用设置</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<label className="flex items-start gap-3 cursor-pointer">
					<Checkbox
						checked={loggingEnabled}
						onCheckedChange={(checked) => toggleLogging.mutate(!!checked)}
						disabled={loggingQuery.isLoading || toggleLogging.isPending}
						className="mt-0.5 cursor-pointer"
					/>
					<div className="space-y-0.5">
						<Label className="text-sm cursor-pointer">Chromium 日志输出</Label>
						<p className="text-xs text-muted-foreground">
							启用后 Chromium 进程将输出 stderr
							日志，关闭可减少资源占用。修改后对新启动的环境生效。
						</p>
					</div>
				</label>
			</CardContent>
		</Card>
	);
}
