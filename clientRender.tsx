import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './src/routes/index';
import { CartProvider } from './src/context/CartContext';

hydrateRoot(
	document.getElementById("root") as HTMLElement,
	<BrowserRouter>
		<CartProvider>
			<AppRoutes />
		</CartProvider>
	</BrowserRouter>
);