import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './src/routes/index';

hydrateRoot(
	document.getElementById("root") as HTMLElement,
	<BrowserRouter>
		<AppRoutes />
	</BrowserRouter>
);