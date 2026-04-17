import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const confirmSource = readFileSync(
	new URL('./confirm-action-dialog.tsx', import.meta.url),
	'utf8',
);
const alertSource = readFileSync(
	new URL('../ui/alert-dialog.tsx', import.meta.url),
	'utf8',
);

test('confirm action dialog uses built-in alert dialog actions instead of nesting button asChild wrappers', () => {
	assert.equal(confirmSource.includes('AlertDialogCancel asChild'), false);
	assert.equal(confirmSource.includes('AlertDialogAction asChild'), false);
	assert.equal(confirmSource.includes('Button,'), false);
});

test('alert dialog actions expose button styling by default', () => {
	assert.equal(alertSource.includes('buttonVariants'), true);
	assert.equal(alertSource.includes("variant: 'outline'"), true);
	assert.equal(alertSource.includes("variant: 'destructive'"), true);
});
