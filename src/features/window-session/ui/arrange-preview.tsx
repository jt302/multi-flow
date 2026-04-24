import { useMemo } from 'react';

import type { WindowBoundsItem } from '@/entities/window-session/model/types';

type ArrangePreviewProps = {
	workArea: WindowBoundsItem;
	bounds: WindowBoundsItem[];
	labels?: string[];
	canvasWidth?: number;
	canvasHeight?: number;
	className?: string;
};

const PALETTE = [
	'#3b82f6',
	'#10b981',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#06b6d4',
	'#f97316',
	'#ec4899',
	'#84cc16',
	'#6366f1',
];

export function ArrangePreview({
	workArea,
	bounds,
	labels,
	canvasWidth = 240,
	canvasHeight = 150,
	className,
}: ArrangePreviewProps) {
	const { scale, offsetX, offsetY, scaledBounds } = useMemo(() => {
		if (workArea.width <= 0 || workArea.height <= 0) {
			return { scale: 1, offsetX: 0, offsetY: 0, scaledBounds: [] };
		}

		const scaleX = canvasWidth / workArea.width;
		const scaleY = canvasHeight / workArea.height;
		const s = Math.min(scaleX, scaleY) * 0.95;

		const scaledW = workArea.width * s;
		const scaledH = workArea.height * s;
		const ox = (canvasWidth - scaledW) / 2;
		const oy = (canvasHeight - scaledH) / 2;

		const scaled = bounds.map((b) => ({
			x: ox + (b.x - workArea.x) * s,
			y: oy + (b.y - workArea.y) * s,
			width: Math.max(1, b.width * s),
			height: Math.max(1, b.height * s),
		}));

		return { scale: s, offsetX: ox, offsetY: oy, scaledBounds: scaled };
	}, [workArea, bounds, canvasWidth, canvasHeight]);

	const workAreaScaledW = workArea.width * scale;
	const workAreaScaledH = workArea.height * scale;

	return (
		<svg
			role="img"
			aria-label="Window arrangement preview"
			width={canvasWidth}
			height={canvasHeight}
			viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
			className={className}
			style={{ background: 'transparent' }}
		>
			{/* 工作区背景 */}
			<rect
				x={offsetX}
				y={offsetY}
				width={workAreaScaledW}
				height={workAreaScaledH}
				fill="hsl(var(--muted))"
				rx={2}
			/>

			{/* 各窗口矩形 */}
			{scaledBounds.map((b, i) => {
				const color = PALETTE[i % PALETTE.length];
				const label = labels?.[i] ?? String(i + 1);
				const fontSize = Math.min(12, Math.max(6, Math.min(b.width, b.height) * 0.3));

				return (
					<g key={`${label}-${b.x}-${b.y}-${b.width}-${b.height}`}>
						<rect
							x={b.x}
							y={b.y}
							width={b.width}
							height={b.height}
							fill={color}
							fillOpacity={0.25}
							stroke={color}
							strokeWidth={1.5}
							rx={2}
						/>
						{b.width > 12 && b.height > 10 && (
							<text
								x={b.x + b.width / 2}
								y={b.y + b.height / 2}
								textAnchor="middle"
								dominantBaseline="central"
								fontSize={fontSize}
								fontWeight="600"
								fill={color}
								style={{ userSelect: 'none' }}
							>
								{label.length > 4 ? `${label.slice(0, 3)}…` : label}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
}
