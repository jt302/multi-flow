import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2, TestTube, Link, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { McpServer } from '@/entities/mcp/model/types';
import {
	useUpdateMcpServer,
	useDeleteMcpServer,
	useTestMcpConnection,
	useStartMcpOAuth,
} from '../model/use-mcp-mutations';
import { McpToolsPreview } from './mcp-tools-preview';

const schema = z.object({
	name: z.string().min(1, 'required'),
	transport: z.enum(['stdio', 'sse', 'http']),
	command: z.string().optional(),
	argsJson: z.string().optional(),
	envJson: z.string().optional(),
	url: z.string().optional(),
	headersJson: z.string().optional(),
	authType: z.enum(['none', 'bearer', 'oauth']),
	bearerToken: z.string().optional(),
	oauthConfigJson: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
	server: McpServer;
	onDeleted: () => void;
};

export function McpServerEditor({ server, onDeleted }: Props) {
	const { t } = useTranslation('chat');
	const updateServer = useUpdateMcpServer();
	const deleteServer = useDeleteMcpServer();
	const testConnection = useTestMcpConnection();
	const startOAuth = useStartMcpOAuth();

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: server.name,
			transport: server.transport,
			command: server.command ?? '',
			argsJson: server.argsJson,
			envJson: server.envJson,
			url: server.url ?? '',
			headersJson: server.headersJson,
			authType: server.authType,
			bearerToken: server.bearerToken ?? '',
			oauthConfigJson: server.oauthConfigJson ?? '',
		},
	});

	// 当切换 server 时重置表单
	useEffect(() => {
		form.reset({
			name: server.name,
			transport: server.transport,
			command: server.command ?? '',
			argsJson: server.argsJson,
			envJson: server.envJson,
			url: server.url ?? '',
			headersJson: server.headersJson,
			authType: server.authType,
			bearerToken: server.bearerToken ?? '',
			oauthConfigJson: server.oauthConfigJson ?? '',
		});
	}, [server.id]);

	const transport = form.watch('transport');
	const authType = form.watch('authType');

	const onSubmit = (values: FormValues) => {
		updateServer.mutate(
			{
				id: server.id,
				payload: {
					name: values.name,
					transport: values.transport,
					command: values.command || null,
					argsJson: values.argsJson,
					envJson: values.envJson,
					url: values.url || null,
					headersJson: values.headersJson,
					authType: values.authType,
					bearerToken: values.bearerToken || null,
					oauthConfigJson: values.oauthConfigJson || null,
				},
			},
			{
				onSuccess: () => toast.success(t('mcp.saved')),
				onError: (err) => toast.error(String(err)),
			},
		);
	};

	const handleDelete = () => {
		deleteServer.mutate(server.id, {
			onSuccess: () => onDeleted(),
			onError: (err) => toast.error(String(err)),
		});
	};

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-y-auto">
			<div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
				<span className="text-sm font-medium truncate">{server.name}</span>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="h-7 text-xs cursor-pointer gap-1"
						disabled={testConnection.isPending}
						onClick={() => testConnection.mutate(server.id)}
					>
						{testConnection.isPending ? (
							<Loader2 className="size-3 animate-spin" />
						) : (
							<TestTube className="size-3" />
						)}
						{t('mcp.testConnection')}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button type="button" size="icon" variant="ghost" className="size-7 text-destructive cursor-pointer">
								<Trash2 className="size-3.5" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t('mcp.confirmDelete', { name: server.name })}</AlertDialogTitle>
								<AlertDialogDescription>{t('mcp.confirmDeleteDesc')}</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel className="cursor-pointer">{t('common:cancel')}</AlertDialogCancel>
								<AlertDialogAction
									className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
									onClick={handleDelete}
								>
									{t('common:delete')}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			<div className="flex-1 p-4 space-y-4">
				{/* 名称 */}
				<div className="space-y-1.5">
					<Label className="text-xs">{t('mcp.fieldName')}</Label>
					<Input {...form.register('name')} className="h-8 text-sm" />
					{form.formState.errors.name && (
						<p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
					)}
				</div>

				{/* 传输类型 */}
				<div className="space-y-1.5">
					<Label className="text-xs">{t('mcp.fieldTransport')}</Label>
					<Select
						value={form.watch('transport')}
						onValueChange={(v) => form.setValue('transport', v as 'stdio' | 'sse' | 'http')}
					>
						<SelectTrigger size="sm" className="text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="stdio">stdio</SelectItem>
							<SelectItem value="http">http</SelectItem>
							<SelectItem value="sse">sse</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* stdio 字段 */}
				{transport === 'stdio' && (
					<>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldCommand')}</Label>
							<Input {...form.register('command')} className="h-8 text-sm font-mono" placeholder="npx" />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldArgs')}</Label>
							<Textarea
								{...form.register('argsJson')}
								className="text-xs font-mono resize-none"
								rows={3}
								placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldEnv')}</Label>
							<Textarea
								{...form.register('envJson')}
								className="text-xs font-mono resize-none"
								rows={2}
								placeholder='{"API_KEY": "..."}'
							/>
						</div>
					</>
				)}

				{/* http/sse 字段 */}
				{(transport === 'http' || transport === 'sse') && (
					<>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldUrl')}</Label>
							<Input
								{...form.register('url')}
								className="h-8 text-sm"
								placeholder="https://api.example.com/mcp"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldHeaders')}</Label>
							<Textarea
								{...form.register('headersJson')}
								className="text-xs font-mono resize-none"
								rows={2}
								placeholder='{"X-Custom": "value"}'
							/>
						</div>

						{/* 认证类型 */}
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldAuthType')}</Label>
							<Select
								value={form.watch('authType')}
								onValueChange={(v) => form.setValue('authType', v as 'none' | 'bearer' | 'oauth')}
							>
								<SelectTrigger size="sm" className="text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">{t('mcp.authNone')}</SelectItem>
									<SelectItem value="bearer">{t('mcp.authBearer')}</SelectItem>
									<SelectItem value="oauth">{t('mcp.authOAuth')}</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{authType === 'bearer' && (
							<div className="space-y-1.5">
								<Label className="text-xs">{t('mcp.fieldBearerToken')}</Label>
								<Input
									{...form.register('bearerToken')}
									type="password"
									className="h-8 text-sm font-mono"
									placeholder="sk-..."
								/>
							</div>
						)}

						{authType === 'oauth' && (
							<>
								<div className="space-y-1.5">
									<Label className="text-xs">{t('mcp.fieldOAuthConfig')}</Label>
									<Textarea
										{...form.register('oauthConfigJson')}
										className="text-xs font-mono resize-none"
										rows={5}
										placeholder='{"clientId":"...","authUrl":"...","tokenUrl":"...","scopes":["read"]}'
									/>
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-full cursor-pointer gap-1.5"
									disabled={startOAuth.isPending}
									onClick={() => startOAuth.mutate(server.id)}
								>
									{startOAuth.isPending ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Link className="size-3.5" />
									)}
									{t('mcp.startOAuth')}
								</Button>
							</>
						)}
					</>
				)}

				{/* 工具预览 */}
				<McpToolsPreview serverId={server.enabled ? server.id : null} />

				{server.lastError && (
					<div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2">
						<p className="text-xs text-destructive">{server.lastError}</p>
					</div>
				)}
			</div>

			<div className="px-4 py-3 border-t shrink-0 flex justify-end">
				<Button type="submit" size="sm" className="cursor-pointer" disabled={updateServer.isPending}>
					{t('mcp.save')}
				</Button>
			</div>
		</form>
	);
}
