import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./scripts/node-test-asset-loader.mjs', pathToFileURL('./'));
