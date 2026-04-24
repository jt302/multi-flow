import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

const QUERY_KEY = ['dev-chromium-executable'];

export function DevConfigCard() {
	const { t } = useTranslation('settings');
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => tauriInvoke<string | null>('read_dev_chromium_executable'),
	});

	const [localValue, setLocalValue] = useState<string | null>(null);
	// Resolved display value: use local edit if the user is typing, otherwise use saved value
	const savedValue = query.data ?? null;
	const displayValue = localValue ?? savedValue ?? '';

	const saveMutation = useMutation({
		mutationFn: (path: string | null) =>
			tauriInvoke<void>('save_dev_chromium_executable', { path }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
			setLocalValue(null);
			toast.success(t('dev.saved'));
		},
		onError: (err) => {
			toast.error(`${t('dev.saveFailed')}: ${String(err)}`);
		},
	});

	const handleBrowse = async () => {
		const selected = await open({
			multiple: false,
			directory: false,
			title: t('dev.chromiumExecutable'),
		});
		if (selected) {
			const path = typeof selected === 'string' ? selected : selected;
			setLocalValue(path);
			saveMutation.mutate(path);
		}
	};

	const handleClear = () => {
		setLocalValue(null);
		saveMutation.mutate(null);
	};

	const handleSave = () => {
		saveMutation.mutate(displayValue || null);
	};

	const isDirty = localValue !== null && localValue !== savedValue;

	return (
		<Card className="border-border/40 bg-card/60 backdrop-blur-md">
			<CardHeader>
				<CardTitle className="text-base">{t('dev.title')}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label className="text-sm">{t('dev.chromiumExecutable')}</Label>
					<p className="text-xs text-muted-foreground">{t('dev.chromiumExecutableDesc')}</p>
					<div className="flex gap-2">
						<Input
							value={displayValue}
							onChange={(e) => setLocalValue(e.target.value)}
							placeholder={t('dev.chromiumExecutablePlaceholder')}
							className="flex-1 font-mono text-xs"
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={handleBrowse}
							disabled={saveMutation.isPending}
							className="cursor-pointer shrink-0"
						>
							<FolderOpen className="h-4 w-4 mr-1" />
							{t('dev.browse')}
						</Button>
						{savedValue && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleClear}
								disabled={saveMutation.isPending}
								className="cursor-pointer shrink-0"
							>
								<X className="h-4 w-4 mr-1" />
								{t('dev.clear')}
							</Button>
						)}
						{isDirty && (
							<Button
								size="sm"
								onClick={handleSave}
								disabled={saveMutation.isPending}
								className="cursor-pointer shrink-0"
							>
								{t('common:save')}
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						{t('dev.currentActive')}:{' '}
						<span className="font-mono text-foreground/70">{savedValue ?? t('dev.notSet')}</span>
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
