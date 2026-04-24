import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('chat message list loads message images lazily', () => {
	const source = readFileSync(new URL('./chat-message-list.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('loading="lazy"'), true);
	assert.equal(source.includes('decoding="async"'), true);
});

test('chat message lightbox uses yet-another-react-lightbox with the zoom plugin', () => {
	const source = readFileSync(new URL('./chat-message-list.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes("import Lightbox from 'yet-another-react-lightbox'"), true);
	assert.equal(source.includes("import Zoom from 'yet-another-react-lightbox/plugins/zoom'"), true);
	assert.equal(source.includes("import 'yet-another-react-lightbox/styles.css'"), true);
	assert.equal(source.includes('plugins={[Zoom]}'), true);
});

test('chat message lightbox keeps only a fixed close button, wheel zoom, and single-slide behavior', () => {
	const source = readFileSync(new URL('./chat-message-list.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('controller={{ closeOnBackdropClick: true'), true);
	assert.equal(source.includes("toolbar={{ buttons: ['close'] }}"), true);
	assert.equal(source.includes('scrollToZoom: true'), true);
	assert.equal(source.includes('buttonZoom: () => null'), true);
	assert.equal(/carousel=\{\{\s*finite: slides\.length <= 1/.test(source), true);
	assert.equal(source.includes('buttonPrev: slides.length <= 1 ? () => null : undefined'), true);
	assert.equal(source.includes('buttonNext: slides.length <= 1 ? () => null : undefined'), true);
});

test('chat message lightbox no longer relies on the custom dialog implementation', () => {
	const source = readFileSync(new URL('./chat-message-list.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('import { Dialog, DialogContent }'), false);
	assert.equal(source.includes('lightboxZoom'), false);
	assert.equal(source.includes('isZoomOutModifierPressed'), false);
	assert.equal(source.includes('NON_DRAGGABLE_IMAGE_STYLE'), false);
});

test('chat message lightbox customizes container styling instead of using the old dark framed wrapper', () => {
	const source = readFileSync(new URL('./chat-message-list.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('className="ai-chat-lightbox"'), true);
	assert.equal(source.includes('--yarl__color_backdrop'), true);
	assert.equal(source.includes('--yarl__button_filter'), true);
	assert.equal(source.includes("'--yarl__button_padding': '6px'"), true);
	assert.equal(source.includes("'--yarl__icon_size': '18px'"), true);
});
