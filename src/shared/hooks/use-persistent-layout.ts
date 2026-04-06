import { useCallback, useState, useEffect } from 'react';
import type { Layout } from 'react-resizable-panels';

/**
 * 持久化 ResizablePanelGroup 布局的 hook
 * 将布局保存到 localStorage，刷新后可恢复
 */
export function usePersistentLayout({
	id,
	defaultSizes,
}: {
	id: string;
	defaultSizes: number[];
}): {
	defaultLayout: Layout | undefined;
	onLayoutChanged: (sizes: Layout) => void;
} {
	const [defaultLayout, setDefaultLayout] = useState<Layout | undefined>(
		undefined,
	);

	useEffect(() => {
		if (typeof window === 'undefined') {
			setDefaultLayout(defaultSizes as unknown as Layout);
			return;
		}

		try {
			const key = `mf_resizable_layout_${id}`;
			const saved = window.localStorage.getItem(key);
			if (saved) {
				const parsed = JSON.parse(saved) as number[];
				if (
					Array.isArray(parsed) &&
					parsed.every((n) => typeof n === 'number' && !isNaN(n))
				) {
					setDefaultLayout(parsed as unknown as Layout);
					return;
				}
			}
		} catch {
			// 解析失败，使用默认值
		}
		setDefaultLayout(defaultSizes as unknown as Layout);
	}, [id, defaultSizes]);

	const onLayoutChanged = useCallback(
		(sizes: Layout) => {
			if (typeof window === 'undefined') return;
			try {
				const key = `mf_resizable_layout_${id}`;
				window.localStorage.setItem(key, JSON.stringify(sizes));
			} catch {
				// 保存失败时静默处理
			}
		},
		[id],
	);

	return { defaultLayout, onLayoutChanged };
}
