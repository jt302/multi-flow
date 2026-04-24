import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldMarkProfileRecovered } from './use-profile-running-recovery';

test('running recovery ignores profiles closed by user action', () => {
	const recovered = shouldMarkProfileRecovered({
		previousRunning: true,
		currentRunning: false,
		lifecycle: 'active',
		actionState: undefined,
		actionLocked: false,
		closeSuppressed: true,
	});

	assert.equal(recovered, false);
});

test('running recovery marks unexpected running-to-stopped transitions', () => {
	const recovered = shouldMarkProfileRecovered({
		previousRunning: true,
		currentRunning: false,
		lifecycle: 'active',
		actionState: undefined,
		actionLocked: false,
		closeSuppressed: false,
	});

	assert.equal(recovered, true);
});
