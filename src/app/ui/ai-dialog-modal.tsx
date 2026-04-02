import { useEffect, useRef, useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

import {
	listenAiDialogRequest,
	submitAiDialogResponse,
} from '@/entities/automation/api/automation-api';
import type { AiDialogRequest } from '@/entities/automation/model/types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const LEVEL_ICON: Record<string, React.ReactNode> = {
	info: <Info className="h-5 w-5 text-blue-500" />,
	warning: <TriangleAlert className="h-5 w-5 text-yellow-500" />,
	error: <AlertCircle className="h-5 w-5 text-destructive" />,
	success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
};

export function AiDialogModal() {
	const [request, setRequest] = useState<AiDialogRequest | null>(null);
	const [inputValue, setInputValue] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		listenAiDialogRequest((req) => {
			if (!mounted) return;
			// 文件类弹窗直接用原生对话框处理，不走 React UI
			if (
				req.dialogType === 'save_file' ||
				req.dialogType === 'open_file' ||
				req.dialogType === 'select_folder'
			) {
				handleNativeFileDialog(req);
				return;
			}
			setInputValue(req.defaultValue ?? '');
			setSubmitting(false);
			setRequest(req);
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

	/** 使用原生文件对话框 */
	async function handleNativeFileDialog(req: AiDialogRequest) {
		try {
			if (req.dialogType === 'save_file') {
				const filters = req.filters?.map((f) => ({
					name: f.name,
					extensions: f.extensions,
				}));
				const path = await save({
					title: req.title ?? '保存文件',
					defaultPath: req.defaultName,
					filters,
				});
				if (path) {
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: true,
						value: path,
					});
				} else {
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: false,
					});
				}
			} else if (req.dialogType === 'open_file') {
				const filters = req.filters?.map((f) => ({
					name: f.name,
					extensions: f.extensions,
				}));
				const result = await open({
					title: req.title ?? '打开文件',
					multiple: req.multiple ?? false,
					filters,
				});
				if (result) {
					const value = Array.isArray(result) ? result.join('\n') : result;
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: true,
						value,
					});
				} else {
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: false,
					});
				}
			} else if (req.dialogType === 'select_folder') {
				const result = await open({
					title: req.title ?? '选择文件夹',
					directory: true,
					multiple: req.multiple ?? false,
				});
				if (result) {
					const value = Array.isArray(result) ? result.join('\n') : result;
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: true,
						value,
					});
				} else {
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: false,
					});
				}
			}
		} catch {
			await submitAiDialogResponse({
				requestId: req.requestId,
				confirmed: false,
			});
		}
	}

	async function handleConfirm() {
		if (!request) return;
		setSubmitting(true);
		try {
			const value = request.dialogType === 'input' ? inputValue : undefined;
			await submitAiDialogResponse({
				requestId: request.requestId,
				confirmed: true,
				value,
			});
		} finally {
			setRequest(null);
			setSubmitting(false);
		}
	}

	async function handleCancel() {
		if (!request) return;
		setSubmitting(true);
		try {
			await submitAiDialogResponse({
				requestId: request.requestId,
				confirmed: false,
			});
		} finally {
			setRequest(null);
			setSubmitting(false);
		}
	}

	if (!request) return null;

	const icon = LEVEL_ICON[request.level ?? 'info'] ?? LEVEL_ICON.info;

	// ─── confirm 类型 → AlertDialog ───────────────────────────────
	if (request.dialogType === 'confirm') {
		return (
			<AlertDialog open>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							{icon}
							{request.title ?? 'AI 确认'}
						</AlertDialogTitle>
						<AlertDialogDescription className="whitespace-pre-wrap">
							{request.message}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							取消
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirm}
							disabled={submitting}
							className="cursor-pointer"
						>
							确认
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	// ─── message / input 类型 → Dialog ────────────────────────────
	const isInput = request.dialogType === 'input';
	const isMultiline =
		(request.defaultValue?.length ?? 0) > 80 ||
		request.defaultValue?.includes('\n');

	return (
		<Dialog open onOpenChange={() => {}}>
			<DialogContent
				className="max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{icon}
						{request.title ?? (isInput ? 'AI 输入' : 'AI 消息')}
					</DialogTitle>
					<DialogDescription className="whitespace-pre-wrap">
						{request.message}
					</DialogDescription>
				</DialogHeader>

				{isInput && (
					<div className="space-y-1.5 py-2">
						{request.label && <Label>{request.label}</Label>}
						{isMultiline ? (
							<Textarea
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								placeholder={request.placeholder}
								disabled={submitting}
								rows={4}
								autoFocus
							/>
						) : (
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								placeholder={request.placeholder}
								disabled={submitting}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleConfirm();
								}}
								autoFocus
							/>
						)}
					</div>
				)}

				<DialogFooter>
					{request.dialogType === 'message' ? (
						<Button
							onClick={handleConfirm}
							disabled={submitting}
							className="cursor-pointer"
						>
							知道了
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								onClick={handleCancel}
								disabled={submitting}
								className="cursor-pointer"
							>
								取消
							</Button>
							<Button
								onClick={handleConfirm}
								disabled={submitting}
								className="cursor-pointer"
							>
								确定
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
