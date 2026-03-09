import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { ImportProxiesPayload, ProxyProtocol } from '@/features/proxy/model/types';

const schema = z.object({
	protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
	content: z.string().trim().min(1, '请输入代理列表'),
});

type Values = z.infer<typeof schema>;

type ProxyImportDialogProps = {
	open: boolean;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (payload: ImportProxiesPayload) => Promise<void>;
};

const DEFAULT_VALUES: Values = {
	protocol: 'http',
	content: '',
};

export function ProxyImportDialog({ open, pending, onOpenChange, onConfirm }: ProxyImportDialogProps) {
	const {
		handleSubmit,
		setValue,
		watch,
		register,
		reset,
		formState: { errors },
	} = useForm<Values>({
		resolver: zodResolver(schema),
		defaultValues: DEFAULT_VALUES,
	});

	useEffect(() => {
		if (!open) {
			reset(DEFAULT_VALUES);
		}
	}, [open, reset]);

	const protocol = watch('protocol');

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>批量导入代理</DialogTitle>
					<DialogDescription>协议统一选择，每行一个代理。支持 `host:port` 或 `host:port:user:pass`。</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (values) => {
						await onConfirm({
							protocol: values.protocol as ProxyProtocol,
							lines: values.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
						});
						onOpenChange(false);
					})}
				>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">协议</p>
						<Select value={protocol} onValueChange={(value) => setValue('protocol', value as ProxyProtocol, { shouldValidate: true })} disabled={pending}>
							<SelectTrigger className="w-full cursor-pointer">
								<SelectValue placeholder="协议" />
							</SelectTrigger>
							<SelectContent>
								{['http', 'https', 'socks5', 'ssh'].map((item) => (
									<SelectItem key={item} value={item}>{item}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">代理列表</p>
						<Textarea {...register('content')} rows={10} placeholder={'127.0.0.1:8080\n127.0.0.2:8081:user:pass'} disabled={pending} />
						{errors.content ? <p className="mt-1 text-xs text-destructive">{errors.content.message}</p> : null}
					</div>
					<DialogFooter>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button>
						<Button type="submit" className="cursor-pointer" disabled={pending}>开始导入</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
