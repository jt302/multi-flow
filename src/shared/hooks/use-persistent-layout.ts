import { useDefaultLayout } from 'react-resizable-panels';

/**
 * 持久化 ResizablePanelGroup 布局的 hook
 * 内部使用 react-resizable-panels 官方 useDefaultLayout，完整处理 localStorage 读写。
 * defaultSizes 参数已废弃，各 Panel 自身的 defaultSize prop 作为默认值即可。
 */
export function usePersistentLayout({
	id,
}: {
	id: string;
	defaultSizes?: number[];
}) {
	return useDefaultLayout({ id });
}
