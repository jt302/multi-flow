import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link, Loader2, TestTube, Trash2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateMcpServerRequest, McpServer, OAuthDiscoveryResult } from '@/entities/mcp/model/types';
import {
	useCreateMcpServer,
	useDeleteMcpServer,
	useDiscoverMcpOAuth,
	formatMcpErrorMessage,
	useStartMcpOAuth,
	useTestMcpDraftConnection,
	useUpdateMcpServer,
} from '../model/use-mcp-mutations';
import { McpToolsPreview } from './mcp-tools-preview';

const schema = (t: (key: string, options?: Record<string, unknown>) => string) =>
	z
		.object({
			name: z.string().trim().min(1, t('mcp.nameRequired')),
			transport: z.enum(['stdio', 'sse', 'http']),
			command: z.string().optional(),
			argsJson: z.string().optional(),
			envJson: z.string().optional(),
			url: z.string().optional(),
			headersJson: z.string().optional(),
			authType: z.enum(['none', 'bearer', 'oauth']),
			bearerToken: z.string().optional(),
			oauthConfigJson: z.string().optional(),
		})
		.superRefine((values, ctx) => {
			if (values.transport === 'stdio' && !values.command?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t('mcp.commandRequired'),
					path: ['command'],
				});
			}
			if (values.transport === 'stdio') {
				try {
					const parsed = JSON.parse(values.argsJson || '[]');
					if (!Array.isArray(parsed)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: t('mcp.argsJsonInvalid'),
							path: ['argsJson'],
						});
					}
				} catch {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: t('mcp.argsJsonInvalid'),
						path: ['argsJson'],
					});
				}
				try {
					const parsed = JSON.parse(values.envJson || '{}');
					if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: t('mcp.envJsonInvalid'),
							path: ['envJson'],
						});
					}
				} catch {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: t('mcp.envJsonInvalid'),
						path: ['envJson'],
					});
				}
			}
			if ((values.transport === 'http' || values.transport === 'sse') && !values.url?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t('mcp.urlRequired'),
					path: ['url'],
				});
			}
			if (values.transport === 'http' || values.transport === 'sse') {
				try {
					const parsed = JSON.parse(values.headersJson || '{}');
					if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: t('mcp.headersJsonInvalid'),
							path: ['headersJson'],
						});
					}
				} catch {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: t('mcp.headersJsonInvalid'),
						path: ['headersJson'],
					});
				}
			}
		});

type FormValues = z.infer<ReturnType<typeof schema>>;

type Props = {
	server: McpServer | null;
	isNew: boolean;
	onSaved: (serverId: string) => void;
	onDeleted: (serverId: string) => void;
	onCancel: () => void;
};

function buildFormValues(server: McpServer | null, fallbackName: string): FormValues {
	return {
		name: server?.name ?? fallbackName,
		transport: server?.transport ?? 'stdio',
		command: server?.command ?? '',
		argsJson: server?.argsJson ?? '[]',
		envJson: server?.envJson ?? '{}',
		url: server?.url ?? '',
		headersJson: server?.headersJson ?? '{}',
		authType: server?.authType ?? 'none',
		bearerToken: server?.bearerToken ?? '',
		oauthConfigJson: server?.oauthConfigJson ?? '',
	};
}

function toCreatePayload(values: FormValues): CreateMcpServerRequest {
	return {
		name: values.name,
		transport: values.transport,
		command: values.command?.trim() || null,
		argsJson: values.argsJson,
		envJson: values.envJson,
		url: values.url?.trim() || null,
		headersJson: values.headersJson,
		authType: values.authType,
		bearerToken: values.bearerToken?.trim() || null,
		oauthConfigJson: values.oauthConfigJson?.trim() || null,
	};
}

export function McpServerEditor({
	server,
	isNew,
	onSaved,
	onDeleted,
	onCancel,
}: Props) {
	const { t } = useTranslation('chat');
	const [pendingDelete, setPendingDelete] = useState(false);
	const createServer = useCreateMcpServer();
	const updateServer = useUpdateMcpServer();
	const deleteServer = useDeleteMcpServer();
	const testConnection = useTestMcpDraftConnection();
	const startOAuth = useStartMcpOAuth();
	const discoverOAuth = useDiscoverMcpOAuth();
	const initialValues = useMemo(
		() => buildFormValues(server, t('mcp.newServerName')),
		[server, t],
	);
	const formSchema = useMemo(() => schema(t), [t]);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: initialValues,
	});

	useEffect(() => {
		form.reset(initialValues);
	}, [form, initialValues]);

	const transport = form.watch('transport');
	const authType = form.watch('authType');

	const onSubmit = (values: FormValues) => {
		const payload = toCreatePayload(values);
		if (isNew) {
			createServer.mutate(payload, {
				onSuccess: (created) => {
					toast.success(t('mcp.saved'));
					onSaved(created.id);
				},
				onError: (err) => toast.error(String(err)),
			});
			return;
		}

		if (!server?.id) return;
		updateServer.mutate(
			{
				id: server.id,
				payload,
			},
			{
				onSuccess: (updated) => {
					toast.success(t('mcp.saved'));
					onSaved(updated.id);
				},
				onError: (err) => toast.error(String(err)),
			},
		);
	};

	const handleDelete = () => {
		if (!server?.id) return;
		deleteServer.mutate(server.id, {
			onSuccess: () => {
				setPendingDelete(false);
				onDeleted(server.id);
			},
			onError: (err) => toast.error(String(err)),
		});
	};

	const handleTestConnection = async () => {
		const valid = await form.trigger();
		if (!valid) return;
		const payload = toCreatePayload(form.getValues());
		testConnection.mutate(payload);
	};

	return (
		<form
			onSubmit={form.handleSubmit(onSubmit)}
			className="flex max-h-[70vh] min-h-0 flex-col overflow-y-auto"
		>
			<div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
				<span className="truncate text-sm font-medium">
					{isNew ? t('mcp.newServerName') : server?.name}
				</span>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="h-7 gap-1 text-xs cursor-pointer"
						disabled={testConnection.isPending}
						onClick={handleTestConnection}
					>
						{testConnection.isPending ? (
							<Loader2 className="size-3 animate-spin" />
						) : (
							<TestTube className="size-3" />
						)}
						{t('mcp.testConnection')}
					</Button>
					{server?.id ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="size-7 text-destructive cursor-pointer"
							onClick={() => setPendingDelete(true)}
						>
							<Trash2 className="size-3.5" />
						</Button>
					) : null}
				</div>
			</div>

			<div className="flex-1 space-y-4 p-4">
				<div className="space-y-1.5">
					<Label className="text-xs">{t('mcp.fieldName')}</Label>
					<Input {...form.register('name')} className="h-8 text-sm" />
					{form.formState.errors.name ? (
						<p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
					) : null}
				</div>

				<div className="space-y-1.5">
					<Label className="text-xs">{t('mcp.fieldTransport')}</Label>
					<Select
						value={form.watch('transport')}
						onValueChange={(value) =>
							form.setValue('transport', value as 'stdio' | 'sse' | 'http')
						}
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

				{transport === 'stdio' ? (
					<>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldCommand')}</Label>
							<Input
								{...form.register('command')}
								className="h-8 text-sm font-mono"
								placeholder="npx"
							/>
							{form.formState.errors.command ? (
								<p className="text-xs text-destructive">{form.formState.errors.command.message}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldArgs')}</Label>
							<Textarea
								{...form.register('argsJson')}
								className="resize-none text-xs font-mono"
								rows={3}
								placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'
							/>
							{form.formState.errors.argsJson ? (
								<p className="text-xs text-destructive">{form.formState.errors.argsJson.message}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldEnv')}</Label>
							<Textarea
								{...form.register('envJson')}
								className="resize-none text-xs font-mono"
								rows={2}
								placeholder='{"API_KEY": "..."}'
							/>
							{form.formState.errors.envJson ? (
								<p className="text-xs text-destructive">{form.formState.errors.envJson.message}</p>
							) : null}
						</div>
					</>
				) : null}

				{transport === 'http' || transport === 'sse' ? (
					<>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldUrl')}</Label>
							<Input
								{...form.register('url')}
								className="h-8 text-sm"
								placeholder="https://api.example.com/mcp"
							/>
							{form.formState.errors.url ? (
								<p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldHeaders')}</Label>
							<Textarea
								{...form.register('headersJson')}
								className="resize-none text-xs font-mono"
								rows={2}
								placeholder='{"X-Custom": "value"}'
							/>
							{form.formState.errors.headersJson ? (
								<p className="text-xs text-destructive">{form.formState.errors.headersJson.message}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('mcp.fieldAuthType')}</Label>
							<Select
								value={form.watch('authType')}
								onValueChange={(value) =>
									form.setValue('authType', value as 'none' | 'bearer' | 'oauth')
								}
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

						{authType === 'bearer' ? (
							<div className="space-y-1.5">
								<Label className="text-xs">{t('mcp.fieldBearerToken')}</Label>
								<Input
									{...form.register('bearerToken')}
									type="password"
									className="h-8 text-sm font-mono"
									placeholder="sk-..."
								/>
							</div>
						) : null}

						{authType === 'oauth' ? (
							<>
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<Label className="text-xs">{t('mcp.fieldOAuthConfig')}</Label>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="h-6 px-2 text-xs gap-1 cursor-pointer"
											disabled={discoverOAuth.isPending}
											onClick={() => {
												const url = form.getValues('url') || '';
												if (!url) {
													import('sonner').then(({ toast }) => toast.error(t('mcp.discoverNeedsUrl')));
													return;
												}
												discoverOAuth.mutate(url, {
													onSuccess: (result: OAuthDiscoveryResult) => {
														const existing = form.getValues('oauthConfigJson');
														let cfg: Record<string, unknown> = {};
														try { cfg = JSON.parse(existing || '{}'); } catch {}
														cfg.authUrl = result.authorizationEndpoint;
														cfg.tokenUrl = result.tokenEndpoint;
														if (result.scopesSupported.length > 0 && !cfg.scopes) {
															cfg.scopes = result.scopesSupported;
														}
														form.setValue('oauthConfigJson', JSON.stringify(cfg, null, 2), { shouldDirty: true });
														import('sonner').then(({ toast }) => toast.success(t('mcp.discoverSuccess')));
													},
												});
											}}
										>
											{discoverOAuth.isPending ? (
												<Loader2 className="size-3 animate-spin" />
											) : (
												<Link className="size-3" />
											)}
											{t('mcp.discoverOAuth')}
										</Button>
									</div>
									<Textarea
										{...form.register('oauthConfigJson')}
										className="resize-none text-xs font-mono"
										rows={5}
										placeholder='{"clientId":"...","authUrl":"...","tokenUrl":"...","scopes":["read"]}'
									/>
								</div>
								{server?.id ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="w-full gap-1.5 cursor-pointer"
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
								) : null}
							</>
						) : null}
					</>
				) : null}

				{server?.id ? <McpToolsPreview serverId={server.enabled ? server.id : null} /> : null}

				{server?.lastError ? (
					<div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2">
						<p className="text-xs text-destructive">{formatMcpErrorMessage(server.lastError, t)}</p>
					</div>
				) : null}
			</div>

			<DialogFooter className="border-t px-4 py-3 shrink-0">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="cursor-pointer"
					onClick={onCancel}
				>
					{t('common:cancel')}
				</Button>
				<Button
					type="submit"
					size="sm"
					className="cursor-pointer"
					disabled={createServer.isPending || updateServer.isPending}
				>
					{t('mcp.save')}
				</Button>
			</DialogFooter>

			<ConfirmActionDialog
				open={pendingDelete}
				title={t('mcp.confirmDelete', { name: server?.name ?? '' })}
				description={t('mcp.confirmDeleteDesc')}
				confirmText={t('common:delete')}
				pending={deleteServer.isPending}
				onOpenChange={setPendingDelete}
				onConfirm={handleDelete}
			/>
		</form>
	);
}
