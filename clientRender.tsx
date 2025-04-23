import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './src/routes/index';
import AppWrapper from './src/AppWrapper';

hydrateRoot(
	document.getElementById("root") as HTMLElement,
	<BrowserRouter>
		<AppWrapper>
			<AppRoutes />
		</AppWrapper>
	</BrowserRouter>
);