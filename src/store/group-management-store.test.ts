import assert from 'node:assert/strict';
import test from 'node:test';

import { createGroupManagementStore } from './group-management-store.ts';

test('group management store keeps form closed by default', () => {
	const store = createGroupManagementStore();

	assert.equal(store.getState().isFormOpen, false);
	assert.equal(store.getState().editorMode, 'create');
	assert.equal(store.getState().editingGroupId, null);
});

test('group management store tracks search and editor mode', () => {
	const store = createGroupManagementStore({ isFormOpen: false });

	store.getState().setSearchKeyword('airdrop');
	store.getState().openEditForm('grp_1');

	assert.equal(store.getState().searchKeyword, 'airdrop');
	assert.equal(store.getState().isFormOpen, true);
	assert.equal(store.getState().editingGroupId, 'grp_1');
	assert.equal(store.getState().editorMode, 'edit');

	store.getState().closeForm();
	assert.equal(store.getState().isFormOpen, false);
	assert.equal(store.getState().editingGroupId, null);
	assert.equal(store.getState().editorMode, 'create');
});
