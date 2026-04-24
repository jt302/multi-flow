export type FrontendErrorReport = {
	scope: string;
	message: string;
	componentStack?: string;
};

export function reportFrontendError(scope: string, error: Error, componentStack?: string) {
	window.dispatchEvent(
		new CustomEvent<FrontendErrorReport>('multi-flow:frontend-error', {
			detail: {
				scope,
				message: error.message,
				componentStack,
			},
		}),
	);
}
