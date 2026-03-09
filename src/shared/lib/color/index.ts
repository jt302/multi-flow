function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const pure = hex.replace('#', '').trim();
	const normalized = pure.length === 3 ? pure.split('').map((char) => `${char}${char}`).join('') : pure;
	if (!/^[\da-fA-F]{6}$/.test(normalized)) {
		return null;
	}

	const num = Number.parseInt(normalized, 16);
	return {
		r: (num >> 16) & 255,
		g: (num >> 8) & 255,
		b: num & 255,
	};
}

function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function mixHex(colorA: string, colorB: string, ratio: number): string {
	const a = hexToRgb(colorA);
	const b = hexToRgb(colorB);
	if (!a || !b) {
		return colorA;
	}

	const keep = 1 - ratio;
	return rgbToHex(a.r * keep + b.r * ratio, a.g * keep + b.g * ratio, a.b * keep + b.b * ratio);
}

export function getReadableForeground(backgroundHex: string): string {
	const rgb = hexToRgb(backgroundHex);
	if (!rgb) {
		return '#F8FAFC';
	}

	const toLinear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};

	const luminance = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
	return luminance > 0.55 ? '#0F172A' : '#F8FAFC';
}
