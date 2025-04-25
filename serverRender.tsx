import React from 'react';
import express, { Express, Request, Response, NextFunction } from 'express';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import prisma from './src/server/db';
import authRouter from './src/server/routes/auth';
import orderRouter from './src/server/routes/orders';
import stripeRouter from './src/server/routes/stripe';
import addressRouter from './src/server/routes/addresses';
import userRouter from './src/server/routes/user';
import { AuthProvider } from './src/context/AuthContext';
import { ProductProvider } from './src/context/ProductContext';
import { getStripeProducts } from './src/server/utils/stripeProducts';
import { Flavor } from './src/types/flavor';
import subscriptionsRouter from './src/server/routes/subscriptions';
import cardRouter from './src/server/routes/cards';

import AppRoutes from './src/routes/index';
import AppWrapper from './src/AppWrapper';
import { siteData } from './src/utils/content';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
	console.error("Error: STRIPE_SECRET_KEY is not set in the environment variables.");
	// process.exit(1); // Optional: Exit if key is crucial for server start
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

const app: Express = express();

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
	console.error("CRITICAL ERROR: SESSION_SECRET is not defined in .env file. Session management will fail.");
	// Optionally, exit the process if session secret is mandatory
	// process.exit(1);
}

const PgSessionStore = connectPgSimple(session);
const sessionStore = new PgSessionStore({
	conString: process.env.DATABASE_URL,
	tableName: 'Session'
});

app.use(session({
	store: sessionStore,
	secret: sessionSecret || 'fallback-secret-for-dev-only',
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 1000 * 60 * 60 * 24 * 7
		// sameSite: 'lax' // Consider adding for CSRF protection
	}
}));

app.use('/api/stripe', stripeRouter);
app.use(express.static('public'));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
	// console.log('Session ID:', req.sessionID);
	// console.log('Session Data:', req.session);
	next();
});

app.use('/api/auth', authRouter);
app.use('/api/orders', orderRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/users', userRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/cards', cardRouter);

app.get('*', async (req: Request, res: Response) => {
	if (!stripe) {
		console.error("SSR Error: Stripe is not initialized.");
		return res.status(500).send("Server configuration error.");
	}

	let flavorsData: Flavor[] = [];
	try {
		flavorsData = await getStripeProducts(stripe);
	} catch (error) {
		console.error("SSR Error fetching products:", error);
	}

	const initialDataScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify({ flavors: flavorsData }).replace(/</g, '\\u003c')}</script>`;

	const appHtml = renderToString(
		<StaticRouter location={req.url}>
			<ProductProvider initialFlavors={flavorsData}>
				<AppWrapper>
					<AppRoutes />
				</AppWrapper>
			</ProductProvider>
		</StaticRouter>
	);

	res.send(`<!DOCTYPE html>
<head>
	<title>${siteData.name} - ${siteData.tagline}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="/css/style.css" rel="stylesheet">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
	${initialDataScript}
</head>
<body>
	<div id="root" class="min-h-screen flex-col flex">${appHtml}</div>
	<script src="/js/bundle.js" defer></script>
</body>
</html>
	`);
});

app.listen(3000, () => {
	console.log("Server running on port 3000");
});