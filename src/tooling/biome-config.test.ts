/// <reference types="node" />

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(path: string) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

test('project exposes Biome as the unified frontend formatter and checker', () => {
	const packageJson = readJson(resolve(root, 'package.json'));
	const biomeConfigPath = resolve(root, 'biome.json');

	assert.equal(existsSync(biomeConfigPath), true);
	assert.match(packageJson.devDependencies['@biomejs/biome'], /^\d+\.\d+\.\d+$/);
	assert.equal(packageJson.scripts.format, 'biome format --write .');
	assert.equal(packageJson.scripts['format:check'], 'biome format --check .');
	assert.equal(packageJson.scripts.lint, 'biome lint .');
	assert.equal(packageJson.scripts.check, 'biome check .');
	assert.equal(packageJson.scripts['check:write'], 'biome check --write .');

	const biomeConfig = readJson(biomeConfigPath);
	assert.equal(biomeConfig.$schema, './node_modules/@biomejs/biome/configuration_schema.json');
	assert.equal(biomeConfig.formatter.enabled, true);
	assert.equal(biomeConfig.linter.enabled, true);
	assert.equal(biomeConfig.assist.enabled, true);
});
