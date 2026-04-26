import { convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { AlertCircle, CheckCircle2, Clock, Copy, Info, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
	listenAiDialogRequest,
	submitAiDialogResponse,
} from '@/entities/automation/api/automation-api';
import type {
	AiDialogAction,
	AiDialogFormField,
	AiDialogRequest,
} from '@/entities/automation/model/types';
import { MarkdownRenderer } from '@/shared/ui/markdown-renderer';

const LEVEL_ICON: Record<string, React.ReactNode> = {
	info: <Info className="h-5 w-5 text-blue-500" />,
	warning: <TriangleAlert className="h-5 w-5 text-yellow-500" />,
	danger: <TriangleAlert className="h-5 w-5 text-red-500" />,
	error: <AlertCircle className="h-5 w-5 text-destructive" />,
	success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
};

const WIDTH_MAP: Record<string, string> = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
};

function getDialogTableRowKey(row: Record<string, unknown>, columns: { key: string }[]) {
	const explicitKey = row.id ?? row.key ?? row.value ?? row.name;
	if (explicitKey != null) return String(explicitKey);
	return columns.map((col) => `${col.key}:${String(row[col.key] ?? '')}`).join('|');
}

export function AiDialogModal() {
	const { t } = useTranslation('common');
	const [request, setRequest] = useState<AiDialogRequest | null>(null);
	const [inputValue, setInputValue] = useState('');
	const [submitting, setSubmitting] = useState(false);
	// select 弹窗
	const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
	// form 弹窗
	const [formValues, setFormValues] = useState<Record<string, string>>({});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	// table 弹窗
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	// countdown 弹窗
	const [countdown, setCountdown] = useState(0);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const unlistenRef = useRef<(() => void) | null>(null);

	/** 原生文件对话框 */
	const handleNativeFileDialog = useCallback(
		async (req: AiDialogRequest) => {
			try {
				if (req.dialogType === 'save_file') {
					const filters = req.filters?.map((f) => ({
						name: f.name,
						extensions: f.extensions,
					}));
					const path = await save({
						title: req.title ?? t('saveFile'),
						defaultPath: req.defaultName,
						filters,
					});
					await submitAiDialogResponse({
						requestId: req.requestId,
						confirmed: !!path,
						value: path ?? undefined,
					});
				} else if (req.dialogType === 'open_file') {
					const filters = req.filters?.map((f) => ({
						name: f.name,
						extensions: f.extensions,
					}));
					const result = await open({
						title: req.title ?? t('openFile'),
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
						title: req.title ?? t('selectFolder'),
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
		},
		[t],
	);

	/** toast 弹窗处理 */
	const handleToast = useCallback((req: AiDialogRequest) => {
		const actions = req.actions;
		const hasActions = actions && actions.length > 0;

		if (!hasActions) {
			// 无操作按钮：直接 toast 并返回
			const toastFn =
				req.level === 'success'
					? toast.success
					: req.level === 'error'
						? toast.error
						: req.level === 'warning'
							? toast.warning
							: toast.info;
			toastFn(req.title ?? req.message, {
				description: req.title ? req.message : undefined,
				duration: req.durationMs ?? 5000,
			});
			submitAiDialogResponse({
				requestId: req.requestId,
				confirmed: true,
			});
			return;
		}

		// 有操作按钮：toast 带 action
		toast(req.title ?? req.message, {
			description: req.title ? req.message : undefined,
			duration: req.persistent ? Infinity : (req.durationMs ?? 5000),
			action: actions[0]
				? {
						label: actions[0].label,
						onClick: () => {
							submitAiDialogResponse({
								requestId: req.requestId,
								confirmed: true,
								value: actions[0].value,
							});
						},
					}
				: undefined,
			cancel: actions[1]
				? {
						label: actions[1].label,
						onClick: () => {
							submitAiDialogResponse({
								requestId: req.requestId,
								confirmed: true,
								value: actions[1].value,
							});
						},
					}
				: undefined,
			onDismiss: () => {
				submitAiDialogResponse({
					requestId: req.requestId,
					confirmed: false,
				});
			},
		});
	}, []);

	useEffect(() => {
		let mounted = true;

		listenAiDialogRequest((req) => {
			if (!mounted) return;
			// 文件类弹窗直接用原生对话框处理
			if (
				req.dialogType === 'save_file' ||
				req.dialogType === 'open_file' ||
				req.dialogType === 'select_folder'
			) {
				handleNativeFileDialog(req);
				return;
			}
			// toast 类弹窗用 sonner 处理
			if (req.dialogType === 'toast') {
				handleToast(req);
				return;
			}
			// 初始化状态
			setInputValue(req.defaultValue ?? '');
			setSelectedOptions([]);
			setSelectedRows([]);
			setFormErrors({});
			setSubmitting(false);
			// form 默认值
			if (req.dialogType === 'form' && req.fields) {
				const defaults: Record<string, string> = {};
				for (const f of req.fields) {
					defaults[f.name] = f.defaultValue ?? '';
				}
				setFormValues(defaults);
			}
			// countdown 初始化
			if (req.dialogType === 'countdown' && req.seconds) {
				setCountdown(req.seconds);
			}
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
	}, [handleNativeFileDialog, handleToast]);

	const handleConfirm = useCallback(async () => {
		if (!request) return;
		setSubmitting(true);
		try {
			let value: string | undefined;

			switch (request.dialogType) {
				case 'input':
					value = inputValue;
					break;
				case 'select':
					if (request.multiple) {
						value = JSON.stringify(selectedOptions);
					} else {
						value = selectedOptions[0];
					}
					break;
				case 'form': {
					// 校验
					const errors: Record<string, string> = {};
					for (const f of request.fields ?? []) {
						const v = formValues[f.name] ?? '';
						if (f.required && !v) {
							errors[f.name] = t('required');
						}
						if (f.validation && v) {
							try {
								if (!new RegExp(f.validation).test(v)) {
									errors[f.name] = t('invalidFormat');
								}
							} catch {
								/* ignore invalid regex */
							}
						}
					}
					if (Object.keys(errors).length > 0) {
						setFormErrors(errors);
						setSubmitting(false);
						return;
					}
					value = JSON.stringify(formValues);
					break;
				}
				case 'table':
					value = JSON.stringify(selectedRows);
					break;
				case 'image':
					value = JSON.stringify({
						value: inputValue || null,
						action: 'confirm',
					});
					break;
				default:
					break;
			}

			await submitAiDialogResponse({
				requestId: request.requestId,
				confirmed: true,
				value,
			});
		} finally {
			setRequest(null);
			setSubmitting(false);
			if (countdownRef.current) clearInterval(countdownRef.current);
		}
	}, [request, inputValue, selectedOptions, formValues, selectedRows, t]);

	// countdown 定时器
	useEffect(() => {
		if (request?.dialogType !== 'countdown' || countdown <= 0) return;

		countdownRef.current = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					if (countdownRef.current) clearInterval(countdownRef.current);
					// 自动执行
					if (request?.autoProceed) {
						handleConfirm();
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => {
			if (countdownRef.current) clearInterval(countdownRef.current);
		};
	}, [request?.dialogType, handleConfirm, request?.autoProceed, countdown]);

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
			if (countdownRef.current) clearInterval(countdownRef.current);
		}
	}

	async function handleAction(action: AiDialogAction) {
		if (!request) return;
		setSubmitting(true);
		try {
			let value = action.value;
			// image 弹窗带输入
			if (request.dialogType === 'image') {
				value = JSON.stringify({
					value: inputValue || null,
					action: action.value,
				});
			}
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
							{request.title ?? t('aiConfirm')}
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
							{t('cancel')}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirm}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	// ─── select 类型 ──────────────────────────────────────────────
	if (request.dialogType === 'select') {
		const options = request.options ?? [];
		const isMulti = request.multiple ?? false;
		const maxSelect = request.maxSelect;

		function toggleOption(val: string) {
			setSelectedOptions((prev) => {
				if (isMulti) {
					if (prev.includes(val)) return prev.filter((v) => v !== val);
					if (maxSelect && prev.length >= maxSelect) return prev;
					return [...prev, val];
				}
				return [val];
			});
		}

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
							{request.title ?? t('pleaseSelect')}
						</DialogTitle>
						{request.message && (
							<DialogDescription className="whitespace-pre-wrap">
								{request.message}
							</DialogDescription>
						)}
					</DialogHeader>
					<ScrollArea className="max-h-60">
						<div className="space-y-1 py-2">
							{options.map((opt) => {
								const optionId = `ai-dialog-option-${request.requestId}-${opt.value}`;
								return (
									<label
										key={opt.value}
										htmlFor={optionId}
										className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted"
									>
										<Checkbox
											id={optionId}
											checked={selectedOptions.includes(opt.value)}
											onCheckedChange={() => toggleOption(opt.value)}
											disabled={submitting}
											className="mt-0.5"
										/>
										<div className="flex-1 min-w-0">
											<span className="text-sm">{opt.label}</span>
											{opt.description && (
												<p className="text-xs text-muted-foreground">{opt.description}</p>
											)}
										</div>
									</label>
								);
							})}
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancel')}
						</Button>
						<Button
							onClick={handleConfirm}
							disabled={submitting || selectedOptions.length === 0}
							className="cursor-pointer"
						>
							{t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── form 类型 ────────────────────────────────────────────────
	if (request.dialogType === 'form') {
		const fields = request.fields ?? [];

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-lg"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{icon}
							{request.title ?? t('form')}
						</DialogTitle>
						{request.message && (
							<DialogDescription className="whitespace-pre-wrap">
								{request.message}
							</DialogDescription>
						)}
					</DialogHeader>
					<ScrollArea className="max-h-[60vh]">
						<div className="space-y-3 py-2 pl-1 pr-3">
							{fields.map((field) => (
								<FormFieldRenderer
									key={field.name}
									field={field}
									value={formValues[field.name] ?? ''}
									error={formErrors[field.name]}
									disabled={submitting}
									onChange={(v) => setFormValues((prev) => ({ ...prev, [field.name]: v }))}
								/>
							))}
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancel')}
						</Button>
						<Button onClick={handleConfirm} disabled={submitting} className="cursor-pointer">
							{request.submitLabel ?? t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── table 类型 ───────────────────────────────────────────────
	if (request.dialogType === 'table') {
		const columns = request.columns ?? [];
		const rows = request.rows ?? [];
		const isSelectable = request.selectable ?? false;
		const isMulti = request.multiple ?? false;
		const maxH = request.maxHeight ?? 400;

		function toggleRow(idx: number) {
			setSelectedRows((prev) => {
				if (isMulti) {
					return prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx];
				}
				return [idx];
			});
		}

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="grid max-h-[85vh] w-[min(96vw,1200px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader className="gap-2 px-6 pt-6">
						<DialogTitle className="flex items-center gap-2">
							{icon}
							{request.title ?? t('data')}
						</DialogTitle>
						{request.message && (
							<DialogDescription className="whitespace-pre-wrap">
								{request.message}
							</DialogDescription>
						)}
					</DialogHeader>
					<div className="min-h-0 overflow-y-auto px-6" style={{ maxHeight: maxH }}>
						<div className="w-full overflow-x-auto pb-4">
							<div className="w-max min-w-full">
								<Table className="w-max min-w-full">
									<TableHeader>
										<TableRow>
											{isSelectable && <TableHead className="w-10" />}
											{columns.map((col) => (
												<TableHead
													key={col.key}
													style={{ width: col.width, textAlign: col.align ?? 'left' }}
												>
													{col.label}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{rows.map((row, idx) => (
											<TableRow
												key={getDialogTableRowKey(row, columns)}
												className={isSelectable ? 'cursor-pointer hover:bg-muted' : undefined}
												onClick={isSelectable ? () => toggleRow(idx) : undefined}
											>
												{isSelectable && (
													<TableCell>
														<Checkbox
															checked={selectedRows.includes(idx)}
															onCheckedChange={() => toggleRow(idx)}
														/>
													</TableCell>
												)}
												{columns.map((col) => (
													<TableCell
														key={col.key}
														className="max-w-[240px] break-words whitespace-normal align-top"
														style={{ textAlign: col.align ?? 'left' }}
													>
														{String(row[col.key] ?? '')}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					</div>
					<DialogFooter className="border-t bg-background px-6 py-4">
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancel')}
						</Button>
						<Button onClick={handleConfirm} disabled={submitting} className="cursor-pointer">
							{t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── image 类型 ───────────────────────────────────────────────
	if (request.dialogType === 'image') {
		const imageSrc = request.image?.startsWith('data:')
			? request.image
			: request.image?.startsWith('/')
				? convertFileSrc(request.image)
				: `data:image/${request.imageFormat ?? 'png'};base64,${request.image}`;
		const hasInput = !!request.label;
		const actions = request.actions;

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-lg"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{icon}
							{request.title ?? t('imagePreview')}
						</DialogTitle>
						{request.message && (
							<DialogDescription className="whitespace-pre-wrap">
								{request.message}
							</DialogDescription>
						)}
					</DialogHeader>
					<div className="flex justify-center py-2">
						<img
							src={imageSrc}
							alt="dialog preview"
							className="max-h-80 max-w-full rounded object-contain"
						/>
					</div>
					{hasInput && (
						<div className="space-y-1.5">
							<Label>{request.label}</Label>
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								placeholder={request.inputPlaceholder ?? request.placeholder}
								disabled={submitting}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleConfirm();
								}}
								autoFocus
							/>
						</div>
					)}
					<DialogFooter>
						{actions && actions.length > 0 ? (
							<>
								<Button
									variant="outline"
									onClick={handleCancel}
									disabled={submitting}
									className="cursor-pointer"
								>
									{t('cancel')}
								</Button>
								{actions.map((action) => (
									<Button
										key={action.value}
										variant={
											action.variant === 'destructive'
												? 'destructive'
												: action.variant === 'outline'
													? 'outline'
													: 'default'
										}
										onClick={() => handleAction(action)}
										disabled={submitting}
										className="cursor-pointer"
									>
										{action.label}
									</Button>
								))}
							</>
						) : (
							<>
								<Button
									variant="outline"
									onClick={handleCancel}
									disabled={submitting}
									className="cursor-pointer"
								>
									{t('cancel')}
								</Button>
								<Button onClick={handleConfirm} disabled={submitting} className="cursor-pointer">
									{t('ok')}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── countdown 类型 ───────────────────────────────────────────
	if (request.dialogType === 'countdown') {
		const levelColor =
			request.level === 'danger'
				? 'text-red-500'
				: request.level === 'info'
					? 'text-blue-500'
					: 'text-yellow-500';

		return (
			<AlertDialog open>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<Clock className={`h-5 w-5 ${levelColor}`} />
							{request.title ?? t('countdown')}
						</AlertDialogTitle>
						<AlertDialogDescription className="whitespace-pre-wrap">
							{request.message}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="flex justify-center py-4">
						<div
							className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
								request.level === 'danger'
									? 'border-red-500'
									: request.level === 'info'
										? 'border-blue-500'
										: 'border-yellow-500'
							}`}
						>
							<span className={`text-3xl font-bold ${levelColor}`}>{countdown}</span>
						</div>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancel')}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirm}
							disabled={submitting || (countdown > 0 && !request.autoProceed)}
							className="cursor-pointer"
						>
							{countdown > 0
								? `${request.actionLabel ?? t('continue')} (${countdown}s)`
								: (request.actionLabel ?? t('continue'))}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	// ─── markdown 类型 ────────────────────────────────────────────
	if (request.dialogType === 'markdown') {
		const maxH = request.maxHeight ?? 500;
		const widthClass = WIDTH_MAP[request.width ?? 'md'] ?? 'max-w-md';
		const actions = request.actions;

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className={widthClass}
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					{request.title && (
						<DialogHeader>
							<DialogTitle>{request.title}</DialogTitle>
						</DialogHeader>
					)}
					{/*
					 * 不嵌 ScrollArea：DialogContent 自身已有 overflow-y-auto 和
					 * max-h-[calc(100vh-1rem)]，再叠一层 radix ScrollArea 会在视口底部
					 * 产生一条 1px 的水平滚动条 track 残影（CleanShot 截图里那条多余横线）。
					 * 改用普通 div + maxHeight 控制内容滚动，让 DialogContent 主滚动接管。
					 */}
					<div className="overflow-y-auto" style={{ maxHeight: maxH }}>
						<MarkdownRenderer content={request.content ?? ''} className="py-2" />
					</div>
					<DialogFooter>
						{request.copyable && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									navigator.clipboard.writeText(request.content ?? '');
									toast.success(t('copied'));
								}}
								className="cursor-pointer mr-auto"
							>
								<Copy className="h-4 w-4 mr-1" />
								{t('copy')}
							</Button>
						)}
						{actions && actions.length > 0 ? (
							actions.map((action) => (
								<Button
									key={action.value}
									variant={
										action.variant === 'destructive'
											? 'destructive'
											: action.variant === 'outline'
												? 'outline'
												: 'default'
									}
									onClick={() => handleAction(action)}
									disabled={submitting}
									className="cursor-pointer"
								>
									{action.label}
								</Button>
							))
						) : (
							<Button
								onClick={() => {
									submitAiDialogResponse({
										requestId: request.requestId,
										confirmed: true,
										value: 'close',
									});
									setRequest(null);
								}}
								className="cursor-pointer"
							>
								{t('close')}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── message / input 类型（原有） → Dialog ───────────────────
	const isInput = request.dialogType === 'input';
	const isMultiline =
		(request.defaultValue?.length ?? 0) > 80 || request.defaultValue?.includes('\n');

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
						{request.title ?? (isInput ? t('aiInput') : t('aiMessage'))}
					</DialogTitle>
					<DialogDescription className="whitespace-pre-wrap">{request.message}</DialogDescription>
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
						<Button onClick={handleConfirm} disabled={submitting} className="cursor-pointer">
							{t('gotIt')}
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								onClick={handleCancel}
								disabled={submitting}
								className="cursor-pointer"
							>
								{t('cancel')}
							</Button>
							<Button onClick={handleConfirm} disabled={submitting} className="cursor-pointer">
								{t('ok')}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── 表单字段渲染器 ──────────────────────────────────────────────────────

function FormFieldRenderer({
	field,
	value,
	error,
	disabled,
	onChange,
}: {
	field: AiDialogFormField;
	value: string;
	error?: string;
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const fieldType = field.fieldType ?? 'text';

	if (fieldType === 'checkbox') {
		return (
			<div className="flex items-center gap-2">
				<Checkbox
					id={field.name}
					checked={value === 'true'}
					onCheckedChange={(checked) => onChange(String(!!checked))}
					disabled={disabled}
				/>
				<Label htmlFor={field.name} className="cursor-pointer">
					{field.label}
					{field.required && <span className="text-destructive ml-0.5">*</span>}
				</Label>
				{field.hint && <span className="text-xs text-muted-foreground">{field.hint}</span>}
			</div>
		);
	}

	if (fieldType === 'select') {
		return (
			<div className="space-y-1">
				<Label>
					{field.label}
					{field.required && <span className="text-destructive ml-0.5">*</span>}
				</Label>
				<select
					value={value}
					onChange={(e) => onChange(e.target.value)}
					disabled={disabled}
					className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<option value="">{field.placeholder ?? '---'}</option>
					{(field.options ?? []).map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
				{field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
				{error && <p className="text-xs text-destructive">{error}</p>}
			</div>
		);
	}

	if (fieldType === 'textarea') {
		return (
			<div className="space-y-1">
				<Label>
					{field.label}
					{field.required && <span className="text-destructive ml-0.5">*</span>}
				</Label>
				<Textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder}
					disabled={disabled}
					rows={3}
				/>
				{field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
				{error && <p className="text-xs text-destructive">{error}</p>}
			</div>
		);
	}

	// text, number, password, email, url, date
	return (
		<div className="space-y-1">
			<Label>
				{field.label}
				{field.required && <span className="text-destructive ml-0.5">*</span>}
			</Label>
			<Input
				type={fieldType}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={field.placeholder}
				disabled={disabled}
			/>
			{field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
