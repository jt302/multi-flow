import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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

const createSchema = (t: (key: string) => string) =>
	z.object({
		protocol: z.enum(['http', 'https', 'socks5', 'ssh']),
		content: z.string().trim().min(1, t('proxy:enterProxyList')),
	});

type Values = z.infer<ReturnType<typeof createSchema>>;

type ProxyImportDialogProps = {
	open: boolean;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (payload: ImportProxiesPayload) => Promise<void>;
};

const DEFAULT_VALUES = {
	protocol: 'http' as ProxyProtocol,
	content: '',
};

export function ProxyImportDialog({
	open,
	pending,
	onOpenChange,
	onConfirm,
}: ProxyImportDialogProps) {
	const { t } = useTranslation(['proxy', 'common']);

	const schema = useMemo(() => createSchema(t), [t]);

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
					<DialogTitle>{t('proxy:batchImport')}</DialogTitle>
					<DialogDescription>
						{t('proxy:protocolUnified')}，{t('proxy:onePerLine')}。{t('proxy:formatHint')}。
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (values) => {
						await onConfirm({
							protocol: values.protocol as ProxyProtocol,
							lines: values.content
								.split(/\r?\n/)
								.map((line) => line.trim())
								.filter(Boolean),
						});
						onOpenChange(false);
					})}
				>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('common:protocol')}</p>
						<Select
							value={protocol}
							onValueChange={(value) =>
								setValue('protocol', value as ProxyProtocol, { shouldValidate: true })
							}
							disabled={pending}
						>
							<SelectTrigger className="w-full cursor-pointer">
								<SelectValue placeholder={t('proxy:protocolPlaceholder')} />
							</SelectTrigger>
							<SelectContent>
								{['http', 'https', 'socks5', 'ssh'].map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">{t('proxy:list')}</p>
						<Textarea
							{...register('content')}
							rows={10}
							placeholder={'127.0.0.1:8080\n127.0.0.2:8081:user:pass'}
							disabled={pending}
						/>
						{errors.content ? (
							<p className="mt-1 text-xs text-destructive">{errors.content.message}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							className="cursor-pointer"
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							{t('common:cancel')}
						</Button>
						<Button type="submit" className="cursor-pointer" disabled={pending}>
							{pending ? <LoaderCircle className="animate-spin" /> : null}
							{t('proxy:startImport')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
