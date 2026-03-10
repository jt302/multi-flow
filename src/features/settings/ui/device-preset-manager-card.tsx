import { RefreshCw } from 'lucide-react';

import { Badge, Button, Card, CardTitle, Icon } from '@/components/ui';
import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
import { useDevicePresetEditor } from '@/features/settings/model/use-device-preset-editor';
import { DevicePresetForm } from './device-preset-form';
import { DevicePresetList } from './device-preset-list';

type DevicePresetManagerCardProps = {
	devicePresets: ProfileDevicePresetItem[];
	pendingKey: string;
	onRefreshDevicePresets: () => Promise<void>;
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (presetId: string, payload: SaveProfileDevicePresetPayload) => Promise<void>;
};

export function DevicePresetManagerCard({
	devicePresets,
	pendingKey,
	onRefreshDevicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
}: DevicePresetManagerCardProps) {
	const { form, activePreset, activePresetId, setActivePresetId, resetPresetEditor, handleSavePreset } =
		useDevicePresetEditor({
			devicePresets,
			onCreateDevicePreset,
			onUpdateDevicePreset,
			onRefreshDevicePresets,
		});

	return (
		<Card className="p-4">
			<div className="mb-3 flex items-start justify-between gap-3">
				<div>
					<CardTitle className="text-sm">机型映射</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">
						设置页统一管理环境可用设备预设。所有预设均来自数据库，点击列表可编辑，点击新建只会重置表单，只有保存后才会写入数据库。
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge>{devicePresets.length} 个预设</Badge>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => void onRefreshDevicePresets()}
						disabled={Boolean(pendingKey)}
					>
						<Icon icon={RefreshCw} size={12} />
						刷新
					</Button>
				</div>
			</div>

			<div className="grid gap-3 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
				<DevicePresetList
					devicePresets={devicePresets}
					activePresetId={activePresetId}
					onReset={resetPresetEditor}
					onSelect={setActivePresetId}
				/>
				<DevicePresetForm
					form={form}
					activePreset={activePreset}
					onReset={resetPresetEditor}
					onSubmit={() => {
						void handleSavePreset();
					}}
				/>
			</div>
		</Card>
	);
}
