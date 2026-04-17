import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const chatSource = readFileSync(new URL('./ai-chat-page.tsx', import.meta.url), 'utf8');
const skillSource = readFileSync(new URL('../../../features/ai-skill/ui/ai-skill-page.tsx', import.meta.url), 'utf8');
const fsSource = readFileSync(new URL('../../../features/fs-workspace/ui/fs-workspace-page.tsx', import.meta.url), 'utf8');
const mcpSource = readFileSync(new URL('../../../features/mcp/ui/mcp-page.tsx', import.meta.url), 'utf8');
const resizableSource = readFileSync(new URL('../../../components/ui/resizable.tsx', import.meta.url), 'utf8');

test('ai assistant pages persist sidebar widths with the same layout hook', () => {
	assert.equal(chatSource.includes("id: 'ai-chat-layout'"), true);
	assert.equal(skillSource.includes("id: 'ai-skill-layout'"), true);
	assert.equal(fsSource.includes("id: 'fs-workspace-layout'"), true);
	assert.equal(mcpSource.includes("id: 'mcp-layout'"), true);
});

test('ai assistant pages use stable panel ids so saved layouts survive refresh', () => {
	assert.equal(chatSource.includes('id="ai-chat-sidebar"'), true);
	assert.equal(skillSource.includes('id="ai-skill-sidebar"'), true);
	assert.equal(fsSource.includes('id="fs-roots-panel"'), true);
	assert.equal(fsSource.includes('id="fs-directory-panel"'), true);
	assert.equal(fsSource.includes('id="fs-description-panel"'), true);
	assert.equal(mcpSource.includes('id="mcp-sidebar"'), true);
	assert.equal(mcpSource.includes('id="mcp-detail"'), true);
});

test('chat, skill, file system and mcp pages all use the shared resizable handle style', () => {
	assert.equal(chatSource.includes('<ResizableHandle />'), true);
	assert.equal(skillSource.includes('<ResizableHandle />'), true);
	assert.equal(fsSource.includes('<ResizableHandle />'), true);
	assert.equal(mcpSource.includes('<ResizableHandle />'), true);
	assert.equal(mcpSource.includes('<ResizableHandle withHandle />'), false);
});

test('resizable handle renders the drag indicator by default', () => {
	assert.equal(resizableSource.includes('withHandle = true'), true);
	assert.equal(resizableSource.includes('<GripVertical'), true);
});
