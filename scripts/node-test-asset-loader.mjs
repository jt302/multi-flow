export async function load(url, context, nextLoad) {
	if (url.includes("?react") && /\.svg(?:[?#].*)?$/.test(url)) {
		return {
			format: "module",
			shortCircuit: true,
			source:
				"import * as React from 'react'; export default function SvgMock(props) { return React.createElement('svg', props); }",
		};
	}

	if (/\.(svg|png|jpe?g|webp|avif|gif|css)(?:[?#].*)?$/.test(url)) {
		return {
			format: "module",
			shortCircuit: true,
			source: `export default ${JSON.stringify(url)};`,
		};
	}

	return nextLoad(url, context);
}
