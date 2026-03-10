import { Plus } from 'lucide-react';

import { Badge, Button, Icon } from '@/components/ui';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';

function PresetListItem({
	item,
	selected,
	onClick,
}: {
	item: ProfileDevicePresetItem;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="outline"
			className={`relative h-auto w-full justify-start rounded-xl border px-3 py-3 text-left transition ${
				selected
					? 'border-primary/40 bg-primary/10 hover:bg-primary/10'
					: 'border-border/70 bg-background/75 hover:border-primary/25 hover:bg-accent/40'
			}`}
			onClick={onClick}
		>
			<div className="min-w-0 pr-36">
				<p className="truncate text-sm font-medium">{item.label}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{item.platform} · {item.viewportWidth}x{item.viewportHeight} · DPR {item.deviceScaleFactor}
				</p>
			</div>

			<div className="pointer-events-none absolute top-3 right-3 flex max-w-[45%] items-center justify-end gap-1">
				<Badge variant="outline">{item.formFactor}</Badge>
				{item.mobile && item.formFactor.trim().toLowerCase() !== 'mobile' ? (
					<Badge variant="secondary">移动</Badge>
				) : null}
			</div>
		</Button>
	);
}

type DevicePresetListProps = {
	devicePresets: ProfileDevicePresetItem[];
	activePresetId: string | null;
	onReset: () => void;
	onSelect: (presetId: string) => void;
};

export function DevicePresetList({
	devicePresets,
	activePresetId,
	onReset,
	onSelect,
}: DevicePresetListProps) {
	return (
		<div className="space-y-2">
			<Button type="button" variant="outline" className="w-full justify-center" onClick={onReset}>
				<Icon icon={Plus} size={14} />
				新建机型
			</Button>
			<div className="space-y-2 rounded-xl border border-border/70 bg-background/55 p-2">
				{devicePresets.map((item) => (
					<PresetListItem
						key={item.id}
						item={item}
						selected={activePresetId === item.id}
						onClick={() => onSelect(item.id)}
					/>
				))}
			</div>
		</div>
	);
}
