import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/global.css';

function installInputSelectAllHotkey() {
	type MultiFlowWindow = Window & { __multiFlowInputSelectAllBound?: boolean };
	const scopedWindow = window as MultiFlowWindow;
	if (scopedWindow.__multiFlowInputSelectAllBound) {
		return;
	}
	scopedWindow.__multiFlowInputSelectAllBound = true;

	document.addEventListener('keydown', (event) => {
		const isSelectAll = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'a';
		if (!isSelectAll) {
			return;
		}
		const active = document.activeElement;
		if (!active) {
			return;
		}
		if (active instanceof HTMLInputElement) {
			const nonTextInputTypes = new Set([
				'button',
				'checkbox',
				'color',
				'file',
				'hidden',
				'image',
				'radio',
				'range',
				'reset',
				'submit',
			]);
			if (active.disabled || active.readOnly || nonTextInputTypes.has(active.type)) {
				return;
			}
			event.preventDefault();
			active.select();
			return;
		}
		if (active instanceof HTMLTextAreaElement) {
			if (active.disabled || active.readOnly) {
				return;
			}
			event.preventDefault();
			active.select();
			return;
		}
		if (active instanceof HTMLElement && active.isContentEditable) {
			event.preventDefault();
			const range = document.createRange();
			range.selectNodeContents(active);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
		}
	});
}

installInputSelectAllHotkey();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</React.StrictMode>,
);
