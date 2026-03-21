import assert from 'node:assert/strict';
import test from 'node:test';

import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

import { countDeletedRecycleBinItems } from './recycle-bin-counts.ts';

test('countDeletedRecycleBinItems 只统计环境、代理和分组', () => {
	const profiles = [{ lifecycle: 'deleted' }, { lifecycle: 'active' }] as ProfileItem[];
	const proxies = [{ lifecycle: 'deleted' }] as ProxyItem[];
	const groups = [{ lifecycle: 'deleted' }] as GroupItem[];

	assert.equal(
		countDeletedRecycleBinItems({
			profiles,
			proxies,
			groups,
		}),
		3,
	);
});
