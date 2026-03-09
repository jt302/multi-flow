import { Card } from '@/components/ui';

import type { ActiveSectionCardProps } from '@/widgets/console-shell/model/types';

export function ActiveSectionCard({ label, title, description }: ActiveSectionCardProps) {
	return (
		<Card className="mb-3 px-4 py-3">
			<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
			<h2 className="mt-1 text-lg font-semibold">{title}</h2>
			<p className="text-sm text-muted-foreground">{description}</p>
		</Card>
	);
}
