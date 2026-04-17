import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./ai-skill-page.tsx', import.meta.url), 'utf8');
const listSource = readFileSync(new URL('./ai-skill-list.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./ai-skill-editor.tsx', import.meta.url), 'utf8');
const installSource = readFileSync(new URL('./ai-skill-install-dialog.tsx', import.meta.url), 'utf8');
const inputSource = readFileSync(new URL('../../../components/ui/input.tsx', import.meta.url), 'utf8');
const textareaSource = readFileSync(new URL('../../../components/ui/textarea.tsx', import.meta.url), 'utf8');

test('ai skill page opens the editor in a dialog instead of inline panel content', () => {
	assert.equal(pageSource.includes('<Dialog'), true);
	assert.equal(pageSource.includes('open={dialogOpen}'), true);
	assert.equal(pageSource.includes('<AiSkillEditor'), true);
	assert.equal(pageSource.includes('ConfirmActionDialog'), false);
});

test('ai skill list uses in-app delete confirmation instead of system confirm', () => {
	assert.equal(listSource.includes('confirm('), false);
	assert.equal(listSource.includes('ConfirmActionDialog'), true);
	assert.equal(listSource.includes('pendingDelete'), true);
});

test('ai skill flow clears selected state when deleting the active skill', () => {
	assert.equal(pageSource.includes('handleDeleted'), true);
	assert.equal(pageSource.includes('deletedSlug === selectedSlug'), true);
	assert.equal(pageSource.includes('setSelectedSlug(null);'), true);
});

test('ai skill editor remains form-based for dialog reuse', () => {
	assert.equal(editorSource.includes('react-hook-form'), true);
	assert.equal(editorSource.includes('zodResolver'), true);
	assert.equal(editorSource.includes('overflow-auto p-1'), true);
});

test('shared text fields raise focus layer above nearby elements', () => {
	assert.equal(inputSource.includes('focus-visible:z-10'), true);
	assert.equal(textareaSource.includes('focus-visible:z-10'), true);
});

test('ai skill page exposes an install entry and dialog', () => {
	assert.equal(pageSource.includes('handleInstall'), true);
	assert.equal(pageSource.includes('installDialogOpen'), true);
	assert.equal(pageSource.includes('skills.installTitle'), true);
});

test('ai skill install dialog shows loading feedback while submitting', () => {
	assert.equal(installSource.includes('LoaderCircle'), true);
	assert.equal(installSource.includes("installSkill.isPending ? t('skills.installPending') : t('skills.installAction')"), true);
	assert.equal(installSource.includes("className=\"size-4 animate-spin\""), true);
});
