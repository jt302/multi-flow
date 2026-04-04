import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';

import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { UpdateProxyPayload, ProxyProtocol } from '@/features/proxy/model/types';

const PROTOCOL_OPTIONS: ProxyProtocol[] = ['http', 'https', 'socks5', 'ssh'];

const batchEditSchema = z
	.object({
		applyName: z.boolean(),
		name: z.string(),
		applyProtocol: z.boolean(),
		protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
		applyUsername: z.boolean(),
		username: z.string(),
		applyPassword: z.boolean(),
		password: z.string(),
		applyProvider: z.boolean(),
		provider: z.string(),
		applyNote: z.boolean(),
		note: z.string(),
		applyExpiresAt: z.boolean(),
		expiresAt: z.string(),
	})
	.superRefine((values, ctx) => {
		const applyCount = [
			values.applyName,
			values.applyProtocol,
			values.applyUsername,
			values.applyPassword,
			values.applyProvider,
			values.applyNote,
			values.applyExpiresAt,
		].filter(Boolean).length;
		if (applyCount === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '至少选择一个要批量更新的字段',
				path: ['applyName'],
			});
		}
		if (values.applyName && values.name.trim().length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '已勾选名称时，名称不能为空',
				path: ['name'],
			});
		}
	});

type BatchEditValues = z.infer<typeof batchEditSchema>;

type ProxyBatchEditDialogProps = {
	open: boolean;
	selectedCount: number;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (payload: UpdateProxyPayload) => Promise<void> | void;
};

const DEFAULT_VALUES: BatchEditValues = {
	applyName: false,
	name: '',
	applyProtocol: false,
	protocol: 'http',
	applyUsername: false,
	username: '',
	applyPassword: false,
	password: '',
	applyProvider: false,
	provider: '',
	applyNote: false,
	note: '',
	applyExpiresAt: false,
	expiresAt: '',
};

function parseDateTimeLocalValue(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return 0;
	const timestamp = Date.parse(trimmed);
	if (Number.isNaN(timestamp)) return 0;
	return Math.floor(timestamp / 1000);
}

function buildPayload(values: BatchEditValues): UpdateProxyPayload {
	const payload: UpdateProxyPayload = {};
	if (values.applyName) payload.name = values.name.trim();
	if (values.applyProtocol) payload.protocol = values.protocol;
	if (values.applyUsername) payload.username = values.username.trim();
	if (values.applyPassword) payload.password = values.password.trim();
	if (values.applyProvider) payload.provider = values.provider.trim();
	if (values.applyNote) payload.note = values.note.trim();
	if (values.applyExpiresAt) payload.expiresAt = parseDateTimeLocalValue(values.expiresAt);
	return payload;
}

function FieldRow({
	id,
	label,
	checked,
	onCheckedChange,
	children,
}: {
	id: string;
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2 rounded-lg border border-border/60 p-3">
			<label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-foreground">
				<Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="cursor-pointer" />
				<span>{label}</span>
			</label>
			<div className="pl-6">{children}</div>
		</div>
	);
}

export function ProxyBatchEditDialog({
	open,
	selectedCount,
	pending,
	onOpenChange,
	onConfirm,
}: ProxyBatchEditDialogProps) {
	const { t } = useTranslation(['proxy', 'common']);
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors },
	} = useForm<BatchEditValues>({
		resolver: zodResolver(batchEditSchema),
		defaultValues: DEFAULT_VALUES,
	});

	useEffect(() => {
		if (!open) {
			reset(DEFAULT_VALUES);
		}
	}, [open, reset]);

	const values = watch();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t('proxy:batchEditTitle')}</DialogTitle>
					<DialogDescription>
						{t('proxy:batchEditDesc', { count: selectedCount })}
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (formValues) => {
						await onConfirm(buildPayload(formValues));
						reset(DEFAULT_VALUES);
					})}
				>
					<div className="grid gap-3 md:grid-cols-2">
					<FieldRow
						id="proxy-batch-name"
						label={t('proxy:name')}
						checked={values.applyName}
						onCheckedChange={(checked) => setValue('applyName', checked)}
					>
						<Input {...register('name')} placeholder={t('proxy:batchSetName')} disabled={!values.applyName || pending} />
						{errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name.message}</p> : null}
					</FieldRow>
					<FieldRow
						id="proxy-batch-protocol"
						label={t('proxy:protocol')}
						checked={values.applyProtocol}
						onCheckedChange={(checked) => setValue('applyProtocol', checked)}
					>
						<Select
							value={values.protocol}
							onValueChange={(value) => setValue('protocol', value as ProxyProtocol)}
							disabled={!values.applyProtocol || pending}
						>
							<SelectTrigger className="w-full cursor-pointer">
								<SelectValue placeholder={t('proxy:selectProtocol')} />
							</SelectTrigger>
							<SelectContent>
								{PROTOCOL_OPTIONS.map((protocol) => (
									<SelectItem key={protocol} value={protocol}>
										{protocol}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FieldRow>
					<FieldRow
						id="proxy-batch-username"
						label={t('proxy:username')}
						checked={values.applyUsername}
						onCheckedChange={(checked) => setValue('applyUsername', checked)}
					>
						<Input {...register('username')} placeholder={t('proxy:clearIfEmpty')} disabled={!values.applyUsername || pending} />
					</FieldRow>
					<FieldRow
						id="proxy-batch-password"
						label={t('proxy:password')}
						checked={values.applyPassword}
						onCheckedChange={(checked) => setValue('applyPassword', checked)}
					>
						<Input type="password" {...register('password')} placeholder={t('proxy:clearIfEmpty')} disabled={!values.applyPassword || pending} />
					</FieldRow>
					<FieldRow
						id="proxy-batch-provider"
						label={t('proxy:provider')}
						checked={values.applyProvider}
						onCheckedChange={(checked) => setValue('applyProvider', checked)}
					>
						<Input {...register('provider')} placeholder={t('proxy:clearIfEmpty')} disabled={!values.applyProvider || pending} />
					</FieldRow>
					<FieldRow
						id="proxy-batch-expires-at"
						label={t('proxy:expiresAt')}
						checked={values.applyExpiresAt}
						onCheckedChange={(checked) => setValue('applyExpiresAt', checked)}
					>
						<Input type="datetime-local" {...register('expiresAt')} disabled={!values.applyExpiresAt || pending} />
					</FieldRow>
				</div>
				<FieldRow
					id="proxy-batch-note"
					label={t('proxy:note')}
					checked={values.applyNote}
					onCheckedChange={(checked) => setValue('applyNote', checked)}
				>
					<Textarea {...register('note')} rows={4} placeholder={t('proxy:clearIfEmpty')} disabled={!values.applyNote || pending} />
				</FieldRow>
					{errors.applyName ? <p className="text-xs text-destructive">{errors.applyName.message}</p> : null}
				<DialogFooter>
					<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending} onClick={() => onOpenChange(false)}>
						{t('common:cancel')}
					</Button>
					<Button type="submit" className="cursor-pointer" disabled={pending}>
						{pending ? <LoaderCircle className="animate-spin" /> : null}
						{t('proxy:confirmEdit')}
					</Button>
				</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
