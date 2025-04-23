import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

const router: Router = express.Router();

// Initialize Stripe
// TODO: Consider moving Stripe initialization to a dedicated config file
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;

if (!stripeSecretKey) {
    console.error("CRITICAL STRIPE ERROR: STRIPE_SECRET_KEY is not defined in .env file. Stripe API routes will fail.");
} else {
    stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }); // Use consistent API version
}

// GET /api/stripe/payment-intent/:paymentIntentId
// Retrieves the status of a Stripe PaymentIntent
router.get('/payment-intent/:paymentIntentId', async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe is not configured on the server.' });
    }

    const { paymentIntentId } = req.params;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
        return res.status(400).json({ error: 'Invalid PaymentIntent ID provided.' });
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
        console.error(`Error retrieving PaymentIntent ${paymentIntentId}:`, error);
        // Handle specific Stripe errors if necessary
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(404).json({ error: 'PaymentIntent not found.' });
        } 
        res.status(500).json({ error: error.message || 'Failed to retrieve PaymentIntent status.' });
    }
});

export default router; 