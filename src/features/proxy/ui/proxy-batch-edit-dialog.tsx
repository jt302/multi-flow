import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
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
		applyCountry: z.boolean(),
		country: z.string(),
		applyRegion: z.boolean(),
		region: z.string(),
		applyCity: z.boolean(),
		city: z.string(),
		applyProvider: z.boolean(),
		provider: z.string(),
		applyNote: z.boolean(),
		note: z.string(),
	})
	.superRefine((values, ctx) => {
		const applyCount = [
			values.applyName,
			values.applyProtocol,
			values.applyUsername,
			values.applyPassword,
			values.applyCountry,
			values.applyRegion,
			values.applyCity,
			values.applyProvider,
			values.applyNote,
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
	applyCountry: false,
	country: '',
	applyRegion: false,
	region: '',
	applyCity: false,
	city: '',
	applyProvider: false,
	provider: '',
	applyNote: false,
	note: '',
};

function buildPayload(values: BatchEditValues): UpdateProxyPayload {
	const payload: UpdateProxyPayload = {};
	if (values.applyName) payload.name = values.name.trim();
	if (values.applyProtocol) payload.protocol = values.protocol;
	if (values.applyUsername) payload.username = values.username.trim();
	if (values.applyPassword) payload.password = values.password.trim();
	if (values.applyCountry) payload.country = values.country.trim();
	if (values.applyRegion) payload.region = values.region.trim();
	if (values.applyCity) payload.city = values.city.trim();
	if (values.applyProvider) payload.provider = values.provider.trim();
	if (values.applyNote) payload.note = values.note.trim();
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
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>批量修改代理</DialogTitle>
					<DialogDescription>
						当前已选 {selectedCount} 条代理。仅会覆盖勾选的字段，主机和端口不会被修改。
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
							label="名称"
							checked={values.applyName}
							onCheckedChange={(checked) => setValue('applyName', checked)}
						>
							<Input {...register('name')} placeholder="批量设置名称" disabled={!values.applyName || pending} />
							{errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name.message}</p> : null}
						</FieldRow>
						<FieldRow
							id="proxy-batch-protocol"
							label="协议"
							checked={values.applyProtocol}
							onCheckedChange={(checked) => setValue('applyProtocol', checked)}
						>
							<Select
								value={values.protocol}
								onValueChange={(value) => setValue('protocol', value as ProxyProtocol)}
								disabled={!values.applyProtocol || pending}
							>
								<SelectTrigger className="w-full cursor-pointer">
									<SelectValue placeholder="选择协议" />
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
							label="用户名"
							checked={values.applyUsername}
							onCheckedChange={(checked) => setValue('applyUsername', checked)}
						>
							<Input {...register('username')} placeholder="留空表示清空" disabled={!values.applyUsername || pending} />
						</FieldRow>
						<FieldRow
							id="proxy-batch-password"
							label="密码"
							checked={values.applyPassword}
							onCheckedChange={(checked) => setValue('applyPassword', checked)}
						>
							<Input type="password" {...register('password')} placeholder="留空表示清空" disabled={!values.applyPassword || pending} />
						</FieldRow>
						<FieldRow
							id="proxy-batch-country"
							label="国家"
							checked={values.applyCountry}
							onCheckedChange={(checked) => setValue('applyCountry', checked)}
						>
							<Input {...register('country')} placeholder="留空表示清空" disabled={!values.applyCountry || pending} />
						</FieldRow>
						<FieldRow
							id="proxy-batch-region"
							label="区域"
							checked={values.applyRegion}
							onCheckedChange={(checked) => setValue('applyRegion', checked)}
						>
							<Input {...register('region')} placeholder="留空表示清空" disabled={!values.applyRegion || pending} />
						</FieldRow>
						<FieldRow
							id="proxy-batch-city"
							label="城市"
							checked={values.applyCity}
							onCheckedChange={(checked) => setValue('applyCity', checked)}
						>
							<Input {...register('city')} placeholder="留空表示清空" disabled={!values.applyCity || pending} />
						</FieldRow>
						<FieldRow
							id="proxy-batch-provider"
							label="供应商"
							checked={values.applyProvider}
							onCheckedChange={(checked) => setValue('applyProvider', checked)}
						>
							<Input {...register('provider')} placeholder="留空表示清空" disabled={!values.applyProvider || pending} />
						</FieldRow>
					</div>
					<FieldRow
						id="proxy-batch-note"
						label="备注"
						checked={values.applyNote}
						onCheckedChange={(checked) => setValue('applyNote', checked)}
					>
						<Textarea {...register('note')} rows={4} placeholder="留空表示清空" disabled={!values.applyNote || pending} />
					</FieldRow>
					{errors.applyName ? <p className="text-xs text-destructive">{errors.applyName.message}</p> : null}
					<DialogFooter>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending} onClick={() => onOpenChange(false)}>
							取消
						</Button>
						<Button type="submit" className="cursor-pointer" disabled={pending}>
							确认修改
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
