import React from 'react';
import express, { Express, Request, Response } from 'express';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Stripe from 'stripe';
import dotenv from 'dotenv';

import AppRoutes from './src/routes/index';
import { CartProvider } from './src/context/CartContext';
import { siteData } from './src/utils/content';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
	console.error("Error: STRIPE_SECRET_KEY is not set in the environment variables.");
	// process.exit(1); // Optional: Exit if key is crucial for server start
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

const app: Express = express();

app.use(express.static('public'));
app.use(express.json());

app.use("*", (req, res, next) => {
	next()
})

app.post('/create-payment-intent', async (req: Request, res: Response) => {
	if (!stripe) {
		return res.status(500).send({ error: 'Stripe is not configured.' });
	}

	const { amount } = req.body;

	if (!amount || typeof amount !== 'number' || amount <= 0) {
		return res.status(400).send({ error: 'Invalid amount specified.' });
	}

	try {
		const paymentIntent = await stripe.paymentIntents.create({
			amount: amount,
			currency: 'usd',
			automatic_payment_methods: {
				enabled: true,
			},
		});

		res.send({
			clientSecret: paymentIntent.client_secret,
		});
	} catch (error: any) {
		console.error("Error creating payment intent:", error);
		res.status(500).send({ error: error.message });
	}
});

app.get('*', (req: Request, res: Response) => {
	res.send(`<!DOCTYPE html>
	<head>
		<title>${siteData.name} - ${siteData.tagline}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="/css/style.css" rel="stylesheet">
		<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
	</head>
	<body>
		<div id="root" class="min-h-screen flex-col flex">${renderToString(
		<StaticRouter location={req.url} >
			<CartProvider>
				<AppRoutes />
			</CartProvider>
		</StaticRouter>)}
		</div>
		<script src="/js/bundle.js" defer></script>
	</body>
</html>
	`);
});

app.listen(3000, () => {
	console.log("Server running on port 3000");
});