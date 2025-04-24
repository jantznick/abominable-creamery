import express, { Router, Request, Response } from 'express';
import prisma from '../db';
import Stripe from 'stripe';
import { SessionUser } from '../types';

const router: Router = express.Router();

// Initialize Stripe (Ensure STRIPE_SECRET_KEY is set in .env)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

// --- GET /api/subscriptions ---
// Fetches all subscriptions for the currently logged-in user
router.get('/', async (req: Request, res: Response) => {
    // Inline Auth Check
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const user = req.session.user as SessionUser;

    try {
        const subscriptions = await prisma.subscription.findMany({
            where: {
                userId: user.id,
                // Optionally filter out already cancelled/ended subscriptions if desired
                // status: { in: ['active', 'trialing', 'past_due'] } 
            },
            orderBy: {
                createdAt: 'desc', // Show newest first
            },
            // Include related data if useful for display (adjust based on your schema)
            // include: {
            //     product: { select: { name: true, imageSrc: true } } // Example
            // }
        });

        // TODO: Potentially fetch associated product/price details from Stripe 
        // if not stored adequately in the Subscription model for display purposes.
        // For now, just returning the raw subscription data from DB.

        res.status(200).json(subscriptions);

    } catch (error) {
        console.error(`Error fetching subscriptions for user ${user.id}:`, error);
        res.status(500).json({ message: 'Failed to retrieve subscriptions.' });
    }
});

// --- POST /api/subscriptions/:stripeSubId/cancel ---
// Cancels a subscription at the end of the current period
router.post('/:stripeSubId/cancel', async (req: Request, res: Response) => {
    // 1. Authentication Check
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!stripe) {
         console.error("Subscription Cancel Error: Stripe not configured.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    const user = req.session.user as SessionUser;
    const { stripeSubId } = req.params;

    if (!stripeSubId) {
        return res.status(400).json({ message: 'Missing subscription ID.' });
    }

    try {
        // 2. Authorization: Verify the subscription belongs to the user
        const localSubscription = await prisma.subscription.findFirst({
            where: {
                stripeSubscriptionId: stripeSubId,
                userId: user.id,
            }
        });

        if (!localSubscription) {
            console.warn(`User ${user.id} attempted to cancel unauthorized subscription ${stripeSubId}`);
            return res.status(404).json({ message: 'Subscription not found or access denied.' });
        }

        // Check if already cancelled to avoid unnecessary API calls
        if (localSubscription.cancelAtPeriodEnd) {
             return res.status(400).json({ message: 'Subscription is already set to cancel.' });
        }
        if (localSubscription.status === 'canceled') {
             return res.status(400).json({ message: 'Subscription has already been canceled.' });
        }

        // 3. Stripe API Call: Cancel at period end
        console.log(`Attempting Stripe cancellation for Sub ID: ${stripeSubId}`);
        const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubId, {
            cancel_at_period_end: true,
        });
        console.log(`Stripe subscription ${stripeSubId} set to cancel_at_period_end: ${updatedStripeSubscription.cancel_at_period_end}`);

        // 4. Database Update (Recommended for immediate UI feedback)
        const updatedLocalSubscription = await prisma.subscription.update({
            where: {
                // Use the unique local ID for the update
                id: localSubscription.id 
            },
            data: {
                cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
                // Optionally update status here if Stripe guarantees it changes immediately,
                // but usually relying on the webhook (`customer.subscription.updated`) is safer.
                // status: updatedStripeSubscription.status 
            }
        });

        // 5. Response
        res.status(200).json({ 
            message: 'Subscription scheduled for cancellation at period end.',
            subscription: updatedLocalSubscription // Send back updated local record
         });

    } catch (error: any) {
        console.error(`Error cancelling subscription ${stripeSubId} for user ${user.id}:`, error);
        // Handle specific Stripe errors if necessary
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return res.status(400).json({ message: `Stripe Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Failed to cancel subscription.' });
    }
});

export default router; 