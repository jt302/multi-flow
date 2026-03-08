import { Palette } from 'lucide-react';

import { Button, Card, Icon, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

import { PRESET_KEYS, PRESETS } from '../constants';
import type { ThemeCustomizerCardProps } from '../types';

export function ThemeCustomizerCard({
	useCustomColor,
	preset,
	customColor,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
}: ThemeCustomizerCardProps) {
	return (
		<Card className="min-w-0 p-4">
			<div className="mb-3 flex items-center gap-2">
				<Icon icon={Palette} size={15} />
				<h3 className="text-sm font-semibold">主题定制</h3>
			</div>

			<div className="grid grid-cols-2 gap-2">
				{PRESET_KEYS.map((item) => (
					<Button
						key={item}
						type="button"
						variant="outline"
						onClick={() => onPresetChange(item)}
						className={cn(
							'h-auto flex-col items-start gap-1 rounded-xl px-2 py-2 text-left text-xs',
							!useCustomColor && preset === item && 'border-primary bg-primary/14 text-foreground',
						)}
					>
						<div className="flex items-center gap-1.5">
							<span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRESETS[item].light }} />
							{item}
						</div>
						<p className="text-[11px] text-muted-foreground">亮/暗双态</p>
					</Button>
				))}
			</div>

			<label className="mt-4 block text-xs text-muted-foreground">自定义主色</label>
			<div className="mt-2 flex items-center gap-2">
				<Input
					type="color"
					value={customColor}
					onChange={(event) => onCustomColorChange(event.target.value)}
					className="h-10 w-12 cursor-pointer rounded-lg p-1"
				/>
				<Input
					type="text"
					value={customColor}
					onChange={(event) => onCustomColorChange(event.target.value)}
					className="w-0 min-w-0 flex-1 bg-card uppercase tracking-wide"
				/>
			</div>
			<Button type="button" variant={useCustomColor ? 'default' : 'outline'} onClick={onToggleCustomColor} className="mt-3 w-full">
				{useCustomColor ? '使用自定义主色' : '切换到自定义主色'}
			</Button>
		</Card>
	);
}
