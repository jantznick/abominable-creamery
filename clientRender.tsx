import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProductProvider } from './src/context/ProductContext';
import { Flavor } from './src/types/flavor';

import AppRoutes from './src/routes/index';
import AppWrapper from './src/AppWrapper';

// Read initial data injected by the server
declare global {
    interface Window { __INITIAL_DATA__?: { flavors: Flavor[] }; }
}
const initialFlavors = window.__INITIAL_DATA__?.flavors || [];

hydrateRoot(
	document.getElementById("root") as HTMLElement,
	<BrowserRouter>
		<ProductProvider initialFlavors={initialFlavors}>
			<AppWrapper>
				<AppRoutes />
			</AppWrapper>
		</ProductProvider>
	</BrowserRouter>
);