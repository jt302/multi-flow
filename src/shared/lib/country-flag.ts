export function countryCodeToFlag(code?: string | null): string {
	const trimmed = (code ?? '').trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(trimmed)) return '';
	return String.fromCodePoint(...trimmed.split('').map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
