import { useMemo, useState } from 'react';

import type { AutomationScript } from '@/entities/automation/model/types';

/** 脚本列表搜索过滤 hook */
export function useScriptListFilter(scripts: AutomationScript[]) {
	const [searchQuery, setSearchQuery] = useState('');

	const filtered = useMemo(() => {
		if (!searchQuery.trim()) return scripts;
		const q = searchQuery.toLowerCase();
		return scripts.filter(
			(s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q),
		);
	}, [scripts, searchQuery]);

	return { filtered, searchQuery, setSearchQuery };
}
