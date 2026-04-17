import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { tauriInvoke } from '@/shared/api/tauri-invoke';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── 类型定义 ─────────────────────────────────────────────────────────

interface ToolConfirmationRequest {
	requestId: string;
	toolName: string;
	args: Record<string, unknown>;
	riskLevel: string;
	cwd?: string;
	riskReason?: string;
}

// ── 组件 ─────────────────────────────────────────────────────────────

export function ToolConfirmationModal() {
	const { t } = useTranslation('common');
	const [request, setRequest] = useState<ToolConfirmationRequest | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		getCurrentWindow().listen<ToolConfirmationRequest>('tool-confirmation-request', (event) => {
			if (!mounted) return;
			setRequest(event.payload);
		}).then((unlisten) => {
			if (mounted) {
				unlistenRef.current = unlisten;
			} else {
				unlisten();
			}
		});

		return () => {
			mounted = false;
			unlistenRef.current?.();
		};
	}, []);

	const handleResponse = async (confirmed: boolean) => {
		if (!request || submitting) return;
		setSubmitting(true);
		try {
			await tauriInvoke<void>('submit_tool_confirmation', {
				requestId: request.requestId,
				confirmed,
			});
		} finally {
			setSubmitting(false);
			setRequest(null);
		}
	};

	// 格式化参数为可读文本
	const formatArgs = (args: Record<string, unknown>): string => {
		try {
			const str = JSON.stringify(args, null, 2);
			return str.length > 2000 ? str.slice(0, 2000) + '...' : str;
		} catch {
			return String(args);
		}
	};

	return (
		<AlertDialog open={!!request}>
			<AlertDialogContent className="max-w-md flex flex-col max-h-[80vh]">
				<AlertDialogHeader className="flex-shrink-0">
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-destructive" />
						{t('toolConfirmation.title')}
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3 text-sm">
							<p>{t('toolConfirmation.message')}</p>
							<div className="rounded-md border bg-muted/50 p-3 space-y-2">
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">
										{t('toolConfirmation.toolName')}:
									</span>
									<code className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-mono text-destructive">
										{request?.toolName}
									</code>
								</div>
								{request?.args &&
									Object.keys(request.args).length > 0 && (
										<div>
											<span className="text-muted-foreground">
												{t('toolConfirmation.args')}:
											</span>
											<ScrollArea className="mt-1 h-48">
												<pre className="rounded bg-background p-2 text-xs font-mono whitespace-pre-wrap break-all">
													{formatArgs(request.args)}
												</pre>
											</ScrollArea>
										</div>
									)}
								{request?.cwd && (
									<div className="flex flex-col gap-1">
										<span className="text-muted-foreground">
											{t('toolConfirmation.cwd')}:
										</span>
										<code className="rounded bg-background px-2 py-1 text-xs font-mono break-all">
											{request.cwd}
										</code>
									</div>
								)}
								{request?.riskReason && (
									<div className="flex flex-col gap-1">
										<span className="text-muted-foreground">
											{t('toolConfirmation.riskReason')}:
										</span>
										<p className="rounded bg-background px-2 py-1 text-xs text-foreground">
											{request.riskReason}
										</p>
									</div>
								)}
							</div>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="gap-2 flex-shrink-0">
					<AlertDialogCancel
						onClick={() => void handleResponse(false)}
						disabled={submitting}
						className="cursor-pointer h-9 px-4"
					>
						{t('toolConfirmation.cancel')}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => void handleResponse(true)}
						disabled={submitting}
						className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer h-9 px-4"
					>
						{t('toolConfirmation.confirm')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
