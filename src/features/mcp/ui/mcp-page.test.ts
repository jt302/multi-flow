import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./mcp-page.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./mcp-server-editor.tsx', import.meta.url), 'utf8');
const mutationsSource = readFileSync(new URL('../model/use-mcp-mutations.ts', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../../../entities/mcp/api/mcp-api.ts', import.meta.url), 'utf8');
const commandSource = readFileSync(new URL('../../../../src-tauri/src/commands/mcp_commands.rs', import.meta.url), 'utf8');
const managerSource = readFileSync(new URL('../../../../src-tauri/src/services/mcp/manager.rs', import.meta.url), 'utf8');
const zhChatSource = readFileSync(new URL('../../../shared/i18n/locales/zh-CN/chat.json', import.meta.url), 'utf8');
const enChatSource = readFileSync(new URL('../../../shared/i18n/locales/en-US/chat.json', import.meta.url), 'utf8');

test('mcp page opens create and edit flows in a dialog instead of inline editing', () => {
	assert.equal(pageSource.includes('<Dialog'), true);
	assert.equal(pageSource.includes('open={dialogOpen}'), true);
	assert.equal(pageSource.includes('setIsCreating(true);'), true);
	assert.equal(pageSource.includes('createServer.mutate('), false);
});

test('mcp editor uses in-app delete confirmation and draft connection testing', () => {
	assert.equal(editorSource.includes('ConfirmActionDialog'), true);
	assert.equal(editorSource.includes('AlertDialogTrigger'), false);
	assert.equal(editorSource.includes('testConnection.mutate(payload)'), true);
	assert.equal(editorSource.includes('server?.id'), true);
	assert.equal(editorSource.includes('.superRefine((values, ctx) => {'), true);
	assert.equal(editorSource.includes("t('mcp.commandRequired')"), true);
});

test('mcp mutations and tauri api expose draft connection testing', () => {
	assert.equal(mutationsSource.includes('useTestMcpDraftConnection'), true);
	assert.equal(apiSource.includes("testConnectionDraft: (payload: CreateMcpServerRequest)"), true);
	assert.equal(apiSource.includes("tauriInvoke<string>('test_mcp_connection_draft', { payload })"), true);
});

test('mcp backend exposes a draft test command without persisting the form first', () => {
	assert.equal(commandSource.includes('pub async fn test_mcp_connection_draft('), true);
	assert.equal(managerSource.includes('pub async fn test_connection_draft('), true);
	assert.equal(managerSource.includes('build_server_draft('), true);
});

test('mcp draft test feedback is localized instead of exposing raw backend strings', () => {
	assert.equal(mutationsSource.includes('formatMcpConnectionMessage'), true);
	assert.equal(mutationsSource.includes('formatMcpErrorMessage'), true);
	assert.equal(zhChatSource.includes('"commandRequired":'), true);
	assert.equal(zhChatSource.includes('"connectionTestSuccess":'), true);
	assert.equal(enChatSource.includes('"commandRequired":'), true);
	assert.equal(enChatSource.includes('"connectionTestSuccess":'), true);
});
