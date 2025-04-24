import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("STRIPE ROUTE Error: STRIPE_SECRET_KEY is not set.");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

// Interface for the expected payload in /create-payment-intent
interface CartItemPayload {
	priceId: string;
	quantity: number;
}

const router: Router = express.Router();

// GET /api/stripe/payment-intent/:paymentIntentId
// Retrieves the status of a Stripe PaymentIntent
router.get('/payment-intent/:paymentIntentId', async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe service is not available.' });
    }

    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing Payment Intent ID.' });
    }

    try {
        // Retrieve the PaymentIntent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Send back relevant information (e.g., status, amount)
        res.status(200).json({
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            id: paymentIntent.id,
            // Add any other relevant fields you might need on the frontend
        });

    } catch (error: any) {
        console.error(`Error fetching Payment Intent ${paymentIntentId}:`, error.message);
        // Provide a more specific error message if possible
        if (error.type === 'StripeInvalidRequestError') {
             return res.status(404).json({ error: 'Payment Intent not found or invalid ID.' });
        }
        res.status(500).json({ error: 'Failed to retrieve payment intent status.' });
    }
});

// POST /api/stripe/create-payment-intent - Create a new PaymentIntent
router.post('/create-payment-intent', async (req: Request, res: Response) => {
	if (!stripe) {
		return res.status(500).send({ error: 'Stripe is not configured.' });
	}

	const { items } = req.body as { items: CartItemPayload[] }; 

	if (!items || !Array.isArray(items) || items.length === 0) {
		return res.status(400).send({ error: 'Invalid or empty items array provided.' });
	}

	let totalAmount = 0;
	const lineItemsForVerification: { price: string; quantity: number }[] = []; 

	try {
		for (const item of items) {
			if (!item.priceId || typeof item.priceId !== 'string' || 
			    !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
				console.warn("Invalid item structure received:", item);
				return res.status(400).send({ error: `Invalid item data for priceId: ${item.priceId}` });
			}

			const price = await stripe.prices.retrieve(item.priceId);

			if (!price || !price.active) {
				console.warn(`Price ID ${item.priceId} not found or inactive.`);
				return res.status(400).send({ error: `Invalid or inactive price ID: ${item.priceId}` });
			}

			if (!price.unit_amount) {
				console.warn(`Price ID ${item.priceId} has no unit amount.`);
                return res.status(400).send({ error: `Price ID ${item.priceId} is not valid for purchase.` });
			}

			totalAmount += price.unit_amount * item.quantity;
			lineItemsForVerification.push({ price: item.priceId, quantity: item.quantity });
		}

		if (totalAmount <= 0) {
			return res.status(400).send({ error: 'Calculated total amount must be positive.' });
		}

		const paymentIntent = await stripe.paymentIntents.create({
			amount: totalAmount, 
			currency: 'usd', 
			automatic_payment_methods: {
				enabled: true,
			},
			// payment_method_types: ['card', 'apple-pay', 'google-pay', 'cashapp-pay', 'amazon-pay'],
			metadata: {
				cart_details: JSON.stringify(lineItemsForVerification) 
			}
		});

		res.send({
			clientSecret: paymentIntent.client_secret,
		});

	} catch (error: any) {
		console.error("Error processing payment intent:", error);
		if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
			return res.status(400).send({ error: `Invalid Price ID found in request.` });
		}
		res.status(500).send({ error: 'Internal server error creating payment intent.' });
	}
});

export default router; 