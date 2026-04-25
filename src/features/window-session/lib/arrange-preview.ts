import type {
	ArrangeFlow,
	EdgeInsets,
	LastRowAlign,
	MainPosition,
	WindowArrangeMode,
	WindowBoundsItem,
} from '@/entities/window-session/model/types';

const MIN_WINDOW_W = 200;
const MIN_WINDOW_H = 150;

function divCeil(n: number, d: number): number {
	return Math.ceil(n / d);
}

function computeWorkRect(area: WindowBoundsItem, padding: EdgeInsets): WindowBoundsItem {
	return {
		x: area.x + padding.left,
		y: area.y + padding.top,
		width: Math.max(0, area.width - padding.left - padding.right),
		height: Math.max(0, area.height - padding.top - padding.bottom),
	};
}

function chooseRowsCols(
	n: number,
	rowsHint: number | undefined,
	colsHint: number | undefined,
	rect: WindowBoundsItem,
): [number, number] {
	if (n === 0) return [1, 1];

	if (rowsHint !== undefined && colsHint !== undefined) {
		return [Math.max(1, rowsHint), Math.max(1, colsHint)];
	}
	if (rowsHint !== undefined) {
		const r = Math.max(1, rowsHint);
		return [r, divCeil(n, r)];
	}
	if (colsHint !== undefined) {
		const c = Math.max(1, colsHint);
		return [divCeil(n, c), c];
	}

	// auto：选使单格宽高比最接近屏幕宽高比的列数，同时惩罚空格
	const areaAspect = rect.height > 0 ? rect.width / rect.height : 16 / 9;
	let bestC = 1;
	let bestScore = Infinity;

	for (let c = 1; c <= n; c++) {
		const r = divCeil(n, c);
		const cellAspect = (c / r) * areaAspect;
		const aspectPenalty = Math.abs(cellAspect / areaAspect - 1);
		const emptyPenalty = (r * c - n) * 0.05;
		const score = aspectPenalty + emptyPenalty;
		if (score < bestScore) {
			bestScore = score;
			bestC = c;
		}
	}

	return [divCeil(n, bestC), bestC];
}

function applyLastRowAlign(
	align: LastRowAlign,
	col: number,
	itemsInRow: number,
	cellW: number,
	gapX: number,
	rectW: number,
): [number, number] {
	switch (align) {
		case 'start':
			return [col * (cellW + gapX), cellW];
		case 'center': {
			const total = itemsInRow * cellW + (itemsInRow - 1) * gapX;
			const offset = Math.max(0, Math.floor((rectW - total) / 2));
			return [offset + col * (cellW + gapX), cellW];
		}
		case 'stretch': {
			const newW = Math.max(
				MIN_WINDOW_W,
				Math.floor((rectW - (itemsInRow - 1) * gapX) / itemsInRow),
			);
			return [col * (newW + gapX), newW];
		}
	}
}

function buildGridBounds(
	rect: WindowBoundsItem,
	n: number,
	rows: number,
	cols: number,
	gapX: number,
	gapY: number,
	lastRowAlign: LastRowAlign,
	flow: ArrangeFlow,
): WindowBoundsItem[] {
	const cellW = Math.max(0, Math.floor((rect.width - (cols - 1) * gapX) / cols));
	const cellH = Math.max(0, Math.floor((rect.height - (rows - 1) * gapY) / rows));
	const targetW = Math.max(MIN_WINDOW_W, cellW);
	const targetH = Math.max(MIN_WINDOW_H, cellH);

	const out: WindowBoundsItem[] = [];

	for (let i = 0; i < n; i++) {
		let row: number, col: number;
		if (flow === 'row_major') {
			row = Math.floor(i / cols);
			col = i % cols;
		} else {
			row = i % rows;
			col = Math.floor(i / rows);
		}

		const isLastRow = row === rows - 1;
		const itemsInRow = isLastRow ? n - row * cols : cols;

		let xOff: number, wI: number;
		if (isLastRow && itemsInRow < cols) {
			[xOff, wI] = applyLastRowAlign(lastRowAlign, col, itemsInRow, targetW, gapX, rect.width);
		} else {
			xOff = col * (targetW + gapX);
			wI = targetW;
		}

		out.push({
			x: rect.x + xOff,
			y: rect.y + row * (cellH + gapY),
			width: wI,
			height: targetH,
		});
	}

	return out;
}

function buildCascadeBounds(
	rect: WindowBoundsItem,
	n: number,
	width: number,
	height: number,
	step: number,
): WindowBoundsItem[] {
	const s = Math.max(8, step);
	const w = Math.max(MIN_WINDOW_W, width);
	const h = Math.max(MIN_WINDOW_H, height);

	return Array.from({ length: n }, (_, i) => {
		const offset = i * s;
		return {
			x: rect.x + Math.min(offset, Math.max(0, rect.width - w)),
			y: rect.y + Math.min(offset, Math.max(0, rect.height - h)),
			width: w,
			height: h,
		};
	});
}

function buildMainSidebarBounds(
	rect: WindowBoundsItem,
	n: number,
	mainRatio: number,
	mainPosition: MainPosition,
	gapX: number,
	gapY: number,
): WindowBoundsItem[] {
	if (n === 0) return [];
	if (n === 1) return [{ ...rect }];

	const ratio = Math.min(0.9, Math.max(0.2, mainRatio));
	const sidebars = n - 1;
	const out: WindowBoundsItem[] = [];

	if (mainPosition === 'left' || mainPosition === 'right') {
		const mainW = Math.max(MIN_WINDOW_W, Math.floor(rect.width * ratio) - Math.floor(gapX / 2));
		const sideW = Math.max(MIN_WINDOW_W, rect.width - mainW - gapX);
		const sideH = Math.max(
			MIN_WINDOW_H,
			Math.floor((rect.height - (sidebars - 1) * gapY) / sidebars),
		);
		const [mainX, sideX] =
			mainPosition === 'left' ? [rect.x, rect.x + mainW + gapX] : [rect.x + sideW + gapX, rect.x];

		out.push({ x: mainX, y: rect.y, width: mainW, height: rect.height });
		for (let i = 0; i < sidebars; i++) {
			out.push({
				x: sideX,
				y: rect.y + i * (sideH + gapY),
				width: sideW,
				height: sideH,
			});
		}
	} else {
		const mainH = Math.max(MIN_WINDOW_H, Math.floor(rect.height * ratio) - Math.floor(gapY / 2));
		const sideH = Math.max(MIN_WINDOW_H, rect.height - mainH - gapY);
		const sideW = Math.max(
			MIN_WINDOW_W,
			Math.floor((rect.width - (sidebars - 1) * gapX) / sidebars),
		);
		const [mainY, sideY] =
			mainPosition === 'top' ? [rect.y, rect.y + mainH + gapY] : [rect.y + sideH + gapY, rect.y];

		out.push({ x: rect.x, y: mainY, width: rect.width, height: mainH });
		for (let i = 0; i < sidebars; i++) {
			out.push({
				x: rect.x + i * (sideW + gapX),
				y: sideY,
				width: sideW,
				height: sideH,
			});
		}
	}

	return out;
}

export type ArrangePreviewParams = {
	workArea: WindowBoundsItem;
	n: number;
	mode: WindowArrangeMode;
	rows?: number;
	columns?: number;
	gapX?: number;
	gapY?: number;
	padding?: EdgeInsets;
	lastRowAlign?: LastRowAlign;
	flow?: ArrangeFlow;
	width?: number;
	height?: number;
	cascadeStep?: number;
	mainRatio?: number;
	mainPosition?: MainPosition;
};

export function computeArrangePreview(params: ArrangePreviewParams): WindowBoundsItem[] {
	const {
		workArea,
		n,
		mode,
		rows,
		columns,
		gapX = 16,
		gapY = 16,
		padding = { top: 12, right: 12, bottom: 12, left: 12 },
		lastRowAlign = 'start',
		flow = 'row_major',
		width = 1280,
		height = 800,
		cascadeStep = 32,
		mainRatio = 0.66,
		mainPosition = 'left',
	} = params;

	if (n === 0) return [];

	const rect = computeWorkRect(workArea, padding);

	switch (mode) {
		case 'grid': {
			const [r, c] = chooseRowsCols(n, rows, columns, rect);
			return buildGridBounds(rect, n, r, c, gapX, gapY, lastRowAlign, flow);
		}
		case 'cascade':
			return buildCascadeBounds(rect, n, width, height, cascadeStep);
		case 'main_with_sidebar':
			return buildMainSidebarBounds(rect, n, mainRatio, mainPosition, gapX, gapY);
	}
}
