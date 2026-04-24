import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';

type AdvancedMaintenanceCardProps = {
	onOpenRecycleBin?: () => void;
};

export function AdvancedMaintenanceCard({ onOpenRecycleBin }: AdvancedMaintenanceCardProps) {
	const { t } = useTranslation('settings');

	return (
		<Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm transition-all duration-300">
			<CardHeader className="p-4 pb-2 border-b border-border/40">
				<CardTitle className="text-sm font-medium">{t('maintenance.title')}</CardTitle>
			</CardHeader>
			<CardContent className="p-4 pt-4 flex items-center justify-between">
				<div className="space-y-1">
					<p className="text-sm font-medium leading-none">{t('maintenance.recycleBin')}</p>
					<p className="text-xs text-muted-foreground">{t('maintenance.recycleBinDesc')}</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="cursor-pointer border-border/40 bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm transition-all hover:scale-105"
					onClick={onOpenRecycleBin}
					disabled={!onOpenRecycleBin}
				>
					<Icon icon={Trash2} size={14} className="mr-1" />
					{t('maintenance.openRecycleBin')}
				</Button>
			</CardContent>
		</Card>
	);
}
