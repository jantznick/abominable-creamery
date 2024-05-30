import React from 'react';
import { hydrateRoot } from 'react-dom/client';

import { App } from './src/App';

function onRecoverableError(error, errInfo) {
	let context = {};

	if (errInfo?.componentStack) {
		// Generating this synthetic error allows monitoring services to apply sourcemaps
		// to unminify the stacktrace and make it readable.
		const errorBoundaryError = new Error(error.message);
		errorBoundaryError.name = `React ErrorBoundary ${errorBoundaryError.name}`;
		errorBoundaryError.stack = errInfo.componentStack;

		// REF: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
		error.cause = errorBoundaryError;

		// You can also just add the plain text as added event context.
		context.componentStack = errInfo.componentStack;
	}

	// Replace with your error monitoring service.
	console.log(error, { context })
}

hydrateRoot(
	document.getElementById("root") as HTMLElement,
	<App />,
	{ onRecoverableError }
);