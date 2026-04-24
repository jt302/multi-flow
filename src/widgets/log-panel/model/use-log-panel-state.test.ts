import assert from 'node:assert/strict';
import test from 'node:test';

import type { BackendLogEvent } from '../../../entities/log-entry/api/logs-api.ts';
import { filterBackendLogs, getLogEventKey, normalizeLogLevel } from './use-log-panel-state.ts';

function createEvent(overrides: Partial<BackendLogEvent>): BackendLogEvent {
	return {
		ts: 1_762_932_800,
		level: 'INFO',
		component: 'engine_manager.magic',
		message: 'default',
		profileId: 'pf_000001',
		profileName: 'Mac 1',
		line: '[1762932800][INFO][engine_manager.magic] default',
		...overrides,
	};
}

test('normalizeLogLevel 兼容大小写和噪声字符', () => {
	assert.equal(normalizeLogLevel(' info '), 'INFO');
	assert.equal(normalizeLogLevel('\u001b[31merror\u001b[0m'), 'ERROR');
	assert.equal(normalizeLogLevel('[warn]'), 'WARN');
});

test('filterBackendLogs 级别过滤只保留目标级别', () => {
	const logs = [
		createEvent({ level: ' INFO ', message: 'info line' }),
		createEvent({
			level: '\u001b[31mERROR\u001b[0m',
			message: 'error line',
			line: '[1762932800][ERROR][engine] error line',
		}),
		createEvent({
			level: '[warn]',
			message: 'warn line',
			line: '[1762932800][WARN][engine] warn line',
		}),
	];

	const result = filterBackendLogs(logs, {
		levelFilter: 'ERROR',
		componentFilter: '',
		profileFilter: '',
		keyword: '',
	});

	assert.equal(result.length, 1);
	assert.equal(normalizeLogLevel(result[0].level), 'ERROR');
	assert.equal(result[0].message, 'error line');
});

test('getLogEventKey 对重复日志生成不同 key', () => {
	const duplicated = createEvent({
		message: 'same line',
		line: '[1762932800][INFO][engine_manager.magic] same line',
	});

	assert.notEqual(getLogEventKey(duplicated, 0), getLogEventKey(duplicated, 1));
});

test('filterBackendLogs 不受 profileName 字段影响', () => {
	const logs = [
		createEvent({ profileId: 'pf_000001', profileName: 'Mac 1', message: 'a' }),
		createEvent({ profileId: 'pf_000002', profileName: 'Mac 2', message: 'b' }),
	];

	const result = filterBackendLogs(logs, {
		levelFilter: 'all',
		componentFilter: '',
		profileFilter: 'pf_000002',
		keyword: '',
	});

	assert.equal(result.length, 1);
	assert.equal(result[0].profileName, 'Mac 2');
});
