import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('proxy list card keeps row render props stable for memoized rows', () => {
	const cardSource = readFileSync(new URL('./proxy-list-card.tsx', import.meta.url), 'utf8');
	const pageSource = readFileSync(new URL('./proxy-page.tsx', import.meta.url), 'utf8');

	assert.equal(cardSource.includes('memo(function ProxyMobileListItem'), true);
	assert.equal(cardSource.includes('memo(function ProxyTableRow'), true);
	assert.equal(cardSource.includes('const selectedProxyIdSet = useMemo('), true);
	assert.equal(cardSource.includes('const checkingProxyIdSet = useMemo('), true);
	assert.equal(cardSource.includes('selectedProxyIds.includes(item.id)'), false);
	assert.equal(cardSource.includes('checkingProxyIds.includes(item.id)'), false);
	assert.equal(cardSource.includes('<ProxyMobileListItem'), true);
	assert.equal(cardSource.includes('<ProxyTableRow'), true);
	assert.equal(pageSource.includes('const handleSelectProxy = useCallback('), true);
	assert.equal(pageSource.includes('const handleCheckProxy = useCallback('), true);
});
