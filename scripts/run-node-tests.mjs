import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'src-tauri/src'];
const testFilePattern = /\.(test|spec)\.tsx?$/;

function collectTestFiles(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTestFiles(path));
		} else if (entry.isFile() && testFilePattern.test(entry.name)) {
			files.push(path);
		}
	}

	return files;
}

const testFiles = roots
	.filter((root) => statSync(root, { throwIfNoEntry: false })?.isDirectory())
	.flatMap(collectTestFiles)
	.sort();

if (testFiles.length === 0) {
	console.log('No Node tests found.');
	process.exit(0);
}

const result = spawnSync(
	process.execPath,
	[
		'--import',
		'tsx',
		'--import',
		'./scripts/register-node-test-assets.mjs',
		'--test',
		...testFiles,
	],
	{ stdio: 'inherit' },
);

process.exit(result.status ?? 1);
