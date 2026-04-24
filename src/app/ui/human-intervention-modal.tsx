import { Clock, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
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
	cancelAutomationRun,
	listenAutomationHumanDismissed,
	listenAutomationHumanRequired,
	resumeAutomationRun,
} from '@/entities/automation/api/automation-api';
import type { AiDialogFormField } from '@/entities/automation/model/types';
import { ProfileBadge } from '@/entities/profile/ui/profile-badge';
import { MarkdownRenderer } from '@/shared/ui/markdown-renderer';
import { useAutomationStore } from '@/store/automation-store';

export function HumanInterventionModal() {
	const [inputValue, setInputValue] = useState('');
	const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const [formValues, setFormValues] = useState<Record<string, string>>({});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [countdown, setCountdown] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const unlistenRefs = useRef<Array<() => void>>([]);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const { t } = useTranslation('common');

	const humanIntervention = useAutomationStore((s) => s.humanIntervention);
	const onHumanRequired = useAutomationStore((s) => s.onHumanRequired);
	const onHumanDismissed = useAutomationStore((s) => s.onHumanDismissed);

	useEffect(() => {
		let mounted = true;

		Promise.all([
			listenAutomationHumanRequired((event) => {
				if (!mounted) return;
				onHumanRequired(event);
				setInputValue('');
				setSelectedOptions([]);
				setSelectedRows([]);
				setFormErrors({});
				setSubmitting(false);
				// form 默认值
				if (event.dialogType === 'form' && event.fields) {
					const defaults: Record<string, string> = {};
					for (const f of event.fields) {
						defaults[f.name] = f.defaultValue ?? '';
					}
					setFormValues(defaults);
				}
				// countdown
				if (event.dialogType === 'countdown' && event.seconds) {
					setCountdown(event.seconds);
				}
			}),
			listenAutomationHumanDismissed((event) => {
				if (!mounted) return;
				onHumanDismissed(event.runId);
			}),
		]).then((unlistens) => {
			unlistenRefs.current = unlistens;
		});

		return () => {
			mounted = false;
			unlistenRefs.current.forEach((u) => u());
		};
	}, [onHumanRequired, onHumanDismissed]);

	// countdown 定时器
	useEffect(() => {
		if (humanIntervention?.dialogType !== 'countdown' || countdown <= 0) return;
		countdownRef.current = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					if (countdownRef.current) clearInterval(countdownRef.current);
					if (humanIntervention?.autoProceed) {
						resumeAutomationRun(humanIntervention.runId, 'true');
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => {
			if (countdownRef.current) clearInterval(countdownRef.current);
		};
	}, [humanIntervention?.dialogType, humanIntervention?.runId]);

	if (!humanIntervention) return null;

	const { runId, message, inputLabel, dialogType, profileId, profileName } = humanIntervention;

	// 统一标题附加 ProfileBadge（在对话框 header 里展示来源环境）
	function TitleWithProfile({ children }: { children: React.ReactNode }) {
		return (
			<span className="flex items-center gap-2 flex-wrap">
				{children}
				{(profileId || profileName) && (
					<ProfileBadge profileId={profileId} profileName={profileName} size="sm" />
				)}
			</span>
		);
	}

	async function handleResume(value?: string) {
		setSubmitting(true);
		try {
			await resumeAutomationRun(runId, value);
		} finally {
			setSubmitting(false);
			if (countdownRef.current) clearInterval(countdownRef.current);
		}
	}

	async function handleCancel() {
		setSubmitting(true);
		try {
			await cancelAutomationRun(runId);
		} finally {
			setSubmitting(false);
			if (countdownRef.current) clearInterval(countdownRef.current);
		}
	}

	// ── confirm dialog ──
	if (dialogType === 'confirm') {
		const title = humanIntervention.title || t('confirm');
		const buttons = humanIntervention.buttons;

		if (buttons && buttons.length > 0) {
			return (
				<Dialog open onOpenChange={() => {}}>
					<DialogContent
						className="max-w-md"
						onInteractOutside={(e) => e.preventDefault()}
						onEscapeKeyDown={(e) => e.preventDefault()}
					>
						<DialogHeader>
							<DialogTitle>
								<TitleWithProfile>{title}</TitleWithProfile>
							</DialogTitle>
						</DialogHeader>
						<div className="py-2">
							<p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
						</div>
						<DialogFooter>
							{buttons.map((btn) => (
								<Button
									key={btn.value}
									variant={
										btn.variant === 'destructive'
											? 'destructive'
											: btn.variant === 'outline'
												? 'outline'
												: 'default'
									}
									onClick={() => handleResume(btn.value)}
									disabled={submitting}
									className="cursor-pointer"
								>
									{btn.text}
								</Button>
							))}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			);
		}

		const confirmText = humanIntervention.confirmText || t('confirm');
		const cancelText = humanIntervention.cancelText || t('cancel');
		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-md"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							<TitleWithProfile>{title}</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => handleResume('false')}
							disabled={submitting}
							className="cursor-pointer"
						>
							{cancelText}
						</Button>
						<Button
							onClick={() => handleResume('true')}
							disabled={submitting}
							className="cursor-pointer"
						>
							{submitting ? t('processing') : confirmText}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── select dialog ──
	if (dialogType === 'select') {
		const title = humanIntervention.title || t('pleaseSelect');
		const options = humanIntervention.options ?? [];
		const multiSelect = humanIntervention.multiSelect ?? false;

		function toggleOption(opt: string) {
			setSelectedOptions((prev) => {
				if (multiSelect) return prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt];
				return [opt];
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
						<DialogTitle>
							<TitleWithProfile>{title}</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						{message && <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>}
						<ScrollArea className="max-h-60">
							<div className="space-y-2">
								{options.map((opt) => (
									<label
										key={opt}
										className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted"
									>
										<Checkbox
											checked={selectedOptions.includes(opt)}
											onCheckedChange={() => toggleOption(opt)}
											disabled={submitting}
										/>
										<span className="text-sm">{opt}</span>
									</label>
								))}
							</div>
						</ScrollArea>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancelRun')}
						</Button>
						<Button
							onClick={() =>
								handleResume(
									multiSelect ? JSON.stringify(selectedOptions) : (selectedOptions[0] ?? ''),
								)
							}
							disabled={submitting || selectedOptions.length === 0}
							className="cursor-pointer"
						>
							{submitting ? t('processing') : t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── form dialog ──
	if (dialogType === 'form') {
		const title = humanIntervention.title || t('form');
		const fields = humanIntervention.fields ?? [];

		function handleFormSubmit() {
			const errors: Record<string, string> = {};
			for (const f of fields) {
				const v = formValues[f.name] ?? '';
				if (f.required && !v) errors[f.name] = t('required');
				if (f.validation && v) {
					try {
						if (!new RegExp(f.validation).test(v)) errors[f.name] = t('invalidFormat');
					} catch {
						/* */
					}
				}
			}
			if (Object.keys(errors).length > 0) {
				setFormErrors(errors);
				return;
			}
			handleResume(JSON.stringify(formValues));
		}

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-lg"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							<TitleWithProfile>{title}</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					{message && <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>}
					<ScrollArea className="max-h-[60vh]">
						<div className="space-y-3 py-2 pl-1 pr-3">
							{fields.map((field) => (
								<HumanFormField
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
							{t('cancelRun')}
						</Button>
						<Button onClick={handleFormSubmit} disabled={submitting} className="cursor-pointer">
							{humanIntervention.submitLabel ?? t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── table dialog ──
	if (dialogType === 'table') {
		const title = humanIntervention.title || t('data');
		const columns = humanIntervention.columns ?? [];
		const rows = humanIntervention.rows ?? [];
		const isSelectable = humanIntervention.selectable ?? false;
		const isMulti = humanIntervention.multiSelect ?? false;
		const maxH = humanIntervention.maxHeight ?? 400;

		function toggleRow(idx: number) {
			setSelectedRows((prev) =>
				isMulti ? (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]) : [idx],
			);
		}

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="flex max-h-[85vh] w-[min(96vw,1200px)] max-w-none flex-col overflow-hidden"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader className="shrink-0">
						<DialogTitle>
							<TitleWithProfile>{title}</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					{message && <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>}
					<ScrollArea className="min-h-0 w-full flex-1" style={{ maxHeight: maxH }}>
						<div className="w-full overflow-x-auto">
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
												key={idx}
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
					</ScrollArea>
					<DialogFooter className="shrink-0">
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancelRun')}
						</Button>
						<Button
							onClick={() => handleResume(JSON.stringify(selectedRows))}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── image dialog ──
	if (dialogType === 'image') {
		const title = humanIntervention.title || t('imagePreview');
		const img = humanIntervention.image ?? '';
		const fmt = humanIntervention.imageFormat ?? 'png';
		const imageSrc = img.startsWith('data:') ? img : `data:image/${fmt};base64,${img}`;
		const hasInput = !!humanIntervention.inputLabel;

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-lg"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							<TitleWithProfile>{title}</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					{message && <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>}
					<div className="flex justify-center py-2">
						<img
							src={imageSrc}
							alt="dialog"
							className="max-h-80 max-w-full rounded object-contain"
						/>
					</div>
					{hasInput && (
						<div className="space-y-1.5">
							<Label>{humanIntervention.inputLabel}</Label>
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								placeholder={humanIntervention.inputPlaceholder}
								disabled={submitting}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleResume(inputValue);
								}}
								autoFocus
							/>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('cancelRun')}
						</Button>
						<Button
							onClick={() => handleResume(hasInput ? inputValue : undefined)}
							disabled={submitting}
							className="cursor-pointer"
						>
							{t('ok')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── countdown dialog ──
	if (dialogType === 'countdown') {
		const title = humanIntervention.title || t('countdown');
		const lvl = humanIntervention.level ?? 'warning';
		const color =
			lvl === 'danger'
				? 'text-red-500 border-red-500'
				: lvl === 'info'
					? 'text-blue-500 border-blue-500'
					: 'text-yellow-500 border-yellow-500';

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-md"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							<TitleWithProfile>
								<span className="flex items-center gap-2">
									<Clock className={`h-5 w-5 ${color.split(' ')[0]}`} />
									{title}
								</span>
							</TitleWithProfile>
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
					<div className="flex justify-center py-4">
						<div
							className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${color}`}
						>
							<span className={`text-3xl font-bold ${color.split(' ')[0]}`}>{countdown}</span>
						</div>
					</div>
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
							onClick={() => handleResume('true')}
							disabled={submitting || (countdown > 0 && !humanIntervention.autoProceed)}
							className="cursor-pointer"
						>
							{countdown > 0
								? `${humanIntervention.actionLabel ?? t('continue')} (${countdown}s)`
								: (humanIntervention.actionLabel ?? t('continue'))}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── markdown dialog ──
	if (dialogType === 'markdown') {
		const title = humanIntervention.title;
		const content = humanIntervention.content ?? '';
		const maxH = humanIntervention.maxHeight ?? 500;
		const actions = humanIntervention.buttons;

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className={
						humanIntervention.width === 'lg'
							? 'max-w-lg'
							: humanIntervention.width === 'xl'
								? 'max-w-xl'
								: 'max-w-md'
					}
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					{title && (
						<DialogHeader>
							<DialogTitle>
								<TitleWithProfile>{title}</TitleWithProfile>
							</DialogTitle>
						</DialogHeader>
					)}
					<ScrollArea style={{ maxHeight: maxH }}>
						<MarkdownRenderer content={content} className="py-2" />
					</ScrollArea>
					<DialogFooter>
						{humanIntervention.copyable && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									navigator.clipboard.writeText(content);
									toast.success(t('copied'));
								}}
								className="cursor-pointer mr-auto"
							>
								<Copy className="h-4 w-4 mr-1" />
								{t('copy')}
							</Button>
						)}
						{actions && actions.length > 0 ? (
							actions.map((btn) => (
								<Button
									key={btn.value}
									variant={
										btn.variant === 'destructive'
											? 'destructive'
											: btn.variant === 'outline'
												? 'outline'
												: 'default'
									}
									onClick={() => handleResume(btn.value)}
									disabled={submitting}
									className="cursor-pointer"
								>
									{btn.text}
								</Button>
							))
						) : (
							<Button
								onClick={() => handleResume('close')}
								disabled={submitting}
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

	// ── default: wait_for_user ──
	const hasInput = inputLabel != null;

	return (
		<Dialog open onOpenChange={() => {}}>
			<DialogContent
				className="max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>
						<TitleWithProfile>{t('waitForManualAction')}</TitleWithProfile>
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
					{hasInput && (
						<div className="space-y-1.5">
							<Label>{inputLabel}</Label>
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleResume(hasInput ? inputValue : undefined);
								}}
								disabled={submitting}
								autoFocus
							/>
						</div>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={submitting}
						className="cursor-pointer"
					>
						{t('cancelRun')}
					</Button>
					<Button
						onClick={() => handleResume(hasInput ? inputValue : undefined)}
						disabled={submitting}
						className="cursor-pointer"
					>
						{submitting ? t('processing') : t('continue')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── 表单字段渲染器 ─────────────────────────────────────────────────────

function HumanFormField({
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
	onChange: (v: string) => void;
}) {
	const ft = field.fieldType ?? 'text';

	if (ft === 'checkbox') {
		return (
			<div className="flex items-center gap-2">
				<Checkbox
					id={field.name}
					checked={value === 'true'}
					onCheckedChange={(c) => onChange(String(!!c))}
					disabled={disabled}
				/>
				<Label htmlFor={field.name} className="cursor-pointer">
					{field.label}
					{field.required && <span className="text-destructive ml-0.5">*</span>}
				</Label>
			</div>
		);
	}
	if (ft === 'select') {
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
					className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<option value="">{field.placeholder ?? '---'}</option>
					{(field.options ?? []).map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				{error && <p className="text-xs text-destructive">{error}</p>}
			</div>
		);
	}
	if (ft === 'textarea') {
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
	return (
		<div className="space-y-1">
			<Label>
				{field.label}
				{field.required && <span className="text-destructive ml-0.5">*</span>}
			</Label>
			<Input
				type={ft}
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
