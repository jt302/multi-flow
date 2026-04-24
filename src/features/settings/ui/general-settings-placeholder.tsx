import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { tauriInvoke } from '@/shared/api/tauri-invoke';
import { normalizeAppLanguage } from '@/shared/i18n';

const LANGUAGE_OPTIONS = [
	{ value: 'zh-CN', label: 'settings:language.zhCN' },
	{ value: 'en-US', label: 'settings:language.enUS' },
] as const;

export function GeneralSettingsPlaceholder() {
	const { t, i18n } = useTranslation('settings');
	const queryClient = useQueryClient();

	const loggingQuery = useQuery({
		queryKey: ['chromium-logging-enabled'],
		queryFn: () => tauriInvoke<boolean>('read_chromium_logging_enabled'),
	});

	const toggleLogging = useMutation({
		mutationFn: (enabled: boolean) =>
			tauriInvoke<void>('update_chromium_logging_enabled', { enabled }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['chromium-logging-enabled'] });
		},
	});

	const updateLanguage = useMutation({
		mutationFn: (locale: string) =>
			tauriInvoke<string>('update_app_language', {
				locale: normalizeAppLanguage(locale),
			}),
		onSuccess: async (locale) => {
			await i18n.changeLanguage(normalizeAppLanguage(locale));
		},
		onError: (error) => {
			toast.error(`${t('language.changeFailed')}: ${String(error)}`);
		},
	});

	const defaultUrlQuery = useQuery({
		queryKey: ['global-default-startup-url'],
		queryFn: () => tauriInvoke<string | null>('read_global_default_startup_url'),
	});

	const [urlInput, setUrlInput] = useState('');
	const [urlError, setUrlError] = useState('');
	useEffect(() => {
		if (defaultUrlQuery.data !== undefined) {
			setUrlInput(defaultUrlQuery.data ?? '');
			setUrlError('');
		}
	}, [defaultUrlQuery.data]);

	const validateUrl = (value: string): boolean => {
		const trimmed = value.trim();
		if (!trimmed) return true;
		try {
			const parsed = new URL(trimmed);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	};

	const saveDefaultUrl = useMutation({
		mutationFn: (url: string) =>
			tauriInvoke<void>('update_global_default_startup_url', {
				url: url.trim() || null,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['global-default-startup-url'] });
			setUrlError('');
			toast.success(t('general.defaultStartupUrlSaved'));
		},
		onError: (error) => {
			toast.error(String(error));
		},
	});

	const loggingEnabled = loggingQuery.data ?? true;

	return (
		<div className="space-y-4">
			<Card className="border-border/40 bg-card/60 backdrop-blur-md">
				<CardHeader>
					<CardTitle className="text-base">{t('general.title')}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<label className="flex items-start gap-3 cursor-pointer">
						<Checkbox
							checked={loggingEnabled}
							onCheckedChange={(checked) => toggleLogging.mutate(!!checked)}
							disabled={loggingQuery.isLoading || toggleLogging.isPending}
							className="mt-0.5 cursor-pointer"
						/>
						<div className="space-y-0.5">
							<Label className="text-sm cursor-pointer">{t('general.chromiumLogging')}</Label>
							<p className="text-xs text-muted-foreground">{t('general.chromiumLoggingDesc')}</p>
						</div>
					</label>

					<div className="space-y-2">
						<Label className="text-sm">{t('general.defaultStartupUrl')}</Label>
						<p className="text-xs text-muted-foreground">{t('general.defaultStartupUrlDesc')}</p>
						<div className="flex gap-2">
							<Input
								value={urlInput}
								onChange={(e) => {
									setUrlInput(e.target.value);
									if (urlError) setUrlError('');
								}}
								onBlur={() => {
									if (!validateUrl(urlInput)) {
										setUrlError(t('general.defaultStartupUrlInvalid'));
									}
								}}
								placeholder={t('general.defaultStartupUrlPlaceholder')}
								disabled={defaultUrlQuery.isLoading || saveDefaultUrl.isPending}
								className={`flex-1 ${urlError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
							/>
							<Button
								size="sm"
								onClick={() => {
									if (!validateUrl(urlInput)) {
										setUrlError(t('general.defaultStartupUrlInvalid'));
										return;
									}
									saveDefaultUrl.mutate(urlInput);
								}}
								disabled={defaultUrlQuery.isLoading || saveDefaultUrl.isPending}
								className="cursor-pointer"
							>
								{t('common:save')}
							</Button>
						</div>
						{urlError && <p className="text-xs text-destructive">{urlError}</p>}
					</div>
				</CardContent>
			</Card>

			<Card className="border-border/40 bg-card/60 backdrop-blur-md">
				<CardHeader>
					<CardTitle className="text-base">{t('language.title')}</CardTitle>
					<p className="text-xs text-muted-foreground">{t('language.desc')}</p>
				</CardHeader>
				<CardContent>
					<Select
						value={normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language)}
						onValueChange={(lng) => {
							if (normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language) === lng) {
								return;
							}
							updateLanguage.mutate(lng);
						}}
					>
						<SelectTrigger className="w-48 cursor-pointer" disabled={updateLanguage.isPending}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LANGUAGE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
									{t(opt.label)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>
		</div>
	);
}
