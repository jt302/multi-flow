import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { tauriInvoke } from '@/shared/api/tauri-invoke';
import { normalizeAppLanguage } from '@/shared/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

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
							<Label className="text-sm cursor-pointer">
								{t('general.chromiumLogging')}
							</Label>
							<p className="text-xs text-muted-foreground">
								{t('general.chromiumLoggingDesc')}
							</p>
						</div>
					</label>
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
						<SelectTrigger
							className="w-48 cursor-pointer"
							disabled={updateLanguage.isPending}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LANGUAGE_OPTIONS.map((opt) => (
								<SelectItem
									key={opt.value}
									value={opt.value}
									className="cursor-pointer"
								>
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
