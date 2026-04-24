import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const chatSource = readFileSync(new URL('./ai-chat-page.tsx', import.meta.url), 'utf8');
const fsSource = readFileSync(
	new URL('../../../features/fs-workspace/ui/fs-workspace-page.tsx', import.meta.url),
	'utf8',
);
const mcpSource = readFileSync(
	new URL('../../../features/mcp/ui/mcp-page.tsx', import.meta.url),
	'utf8',
);
const resizableSource = readFileSync(
	new URL('../../../components/ui/resizable.tsx', import.meta.url),
	'utf8',
);

test('chat and file system pages persist sidebar widths with the shared layout hook', () => {
	assert.equal(chatSource.includes("id: 'ai-chat-layout'"), true);
	assert.equal(fsSource.includes("id: 'fs-workspace-layout'"), true);
});

test('chat and file system pages use stable panel ids so saved layouts survive refresh', () => {
	assert.equal(chatSource.includes('id="ai-chat-sidebar"'), true);
	assert.equal(fsSource.includes('id="fs-roots-panel"'), true);
	assert.equal(fsSource.includes('id="fs-directory-panel"'), true);
	assert.equal(fsSource.includes('id="fs-description-panel"'), true);
});

test('chat and file system pages use the shared resizable handle style', () => {
	assert.equal(chatSource.includes('<ResizableHandle />'), true);
	assert.equal(fsSource.includes('<ResizableHandle />'), true);
});

test('mcp page no longer uses the persisted split layout shell', () => {
	assert.equal(mcpSource.includes("id: 'mcp-layout'"), false);
	assert.equal(mcpSource.includes('<ResizableHandle />'), false);
	assert.equal(mcpSource.includes('ResizablePanelGroup'), false);
});

test('resizable handle renders the drag indicator by default', () => {
	assert.equal(resizableSource.includes('withHandle = true'), true);
	assert.equal(resizableSource.includes('<GripVertical'), true);
});
