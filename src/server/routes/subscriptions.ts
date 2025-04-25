import express, { Router, Request, Response } from 'express';
import prisma from '../db';
import Stripe from 'stripe';
import { SessionUser } from '../types';
import { Subscription } from '@prisma/client';

const router: Router = express.Router();

// Initialize Stripe (Ensure STRIPE_SECRET_KEY is set in .env)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

// Define an interface for the augmented subscription data
interface AugmentedSubscription extends Subscription {
    productName?: string;
    productImage?: string | null;
}

// --- GET /api/subscriptions ---
// Fetches all subscriptions for the currently logged-in user
router.get('/', async (req: Request, res: Response) => {
    // Inline Auth Check
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const user = req.session.user as SessionUser;

    if (!stripe) {
        console.error("GET /api/subscriptions Error: Stripe not configured.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    try {
        const subscriptions = await prisma.subscription.findMany({
            where: {
                userId: user.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Fetch product details from Stripe for each subscription
        const augmentedSubscriptions: AugmentedSubscription[] = await Promise.all(
            subscriptions.map(async (sub) => {
                let productName: string | undefined = undefined;
                let productImage: string | null = null;

                try {
                    if (sub.stripePriceId) {
                        // 1. Fetch the Price object to get the Product ID
                        const price = await stripe!.prices.retrieve(sub.stripePriceId);
                        const productId = typeof price.product === 'string' ? price.product : null;

                        if (productId) {
                            // 2. Fetch the Product object to get name and image
                            const product = await stripe!.products.retrieve(productId);
                            productName = product.name;
                            productImage = product.images?.[0] || null;
                        }
                    }
                } catch (stripeError: any) {
                    console.warn(`Failed to fetch Stripe details for price ${sub.stripePriceId} (Sub ID: ${sub.id}): ${stripeError.message}`);
                    // Continue without product details if Stripe fetch fails
                }

                return {
                    ...sub,
                    productName,
                    productImage,
                };
            })
        );

        res.status(200).json(augmentedSubscriptions);

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

// --- POST /api/subscriptions/:stripeSubId/pause ---
// Pauses payment collection for a subscription indefinitely
router.post('/:stripeSubId/pause', async (req: Request, res: Response) => {
    // 1. Auth Checks
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!stripe) {
        console.error("Subscription Pause Error: Stripe not configured.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    const user = req.session.user as SessionUser;
    const { stripeSubId } = req.params;

    if (!stripeSubId) {
        return res.status(400).json({ message: 'Missing subscription ID.' });
    }

    try {
        // 2. Authorization & Validation
        const localSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId, userId: user.id }
        });

        if (!localSubscription) {
            return res.status(404).json({ message: 'Subscription not found or access denied.' });
        }
        if (localSubscription.status !== 'active') {
             return res.status(400).json({ message: 'Only active subscriptions can be paused.' });
        }
        if (localSubscription.collectionPaused) {
            return res.status(400).json({ message: 'Subscription collection is already paused.' });
        }
        if (localSubscription.cancelAtPeriodEnd) {
            return res.status(400).json({ message: 'Cannot pause a subscription scheduled for cancellation.'});
        }

        // 3. Stripe API Call: Pause collection
        console.log(`Attempting Stripe pause for Sub ID: ${stripeSubId}`);
        const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubId, {
            pause_collection: { behavior: 'mark_uncollectible' },
        });
        console.log(`Stripe subscription ${stripeSubId} pause_collection set.`);

        // 4. Database Update 
        const updatedLocalSubscription = await prisma.subscription.update({
            where: { id: localSubscription.id },
            data: {
                collectionPaused: true,
                // Stripe might keep status 'active', confirm behavior if needed
                // status: updatedStripeSubscription.status 
            }
        });

        // 5. Response
        res.status(200).json({ 
            message: 'Subscription payment collection paused.',
            subscription: updatedLocalSubscription 
         });

    } catch (error: any) {
        console.error(`Error pausing subscription ${stripeSubId} for user ${user.id}:`, error);
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return res.status(400).json({ message: `Stripe Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Failed to pause subscription.' });
    }
});

// --- POST /api/subscriptions/:stripeSubId/resume ---
// Resumes payment collection for a paused subscription
router.post('/:stripeSubId/resume', async (req: Request, res: Response) => {
    // 1. Auth Checks
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
     if (!stripe) {
        console.error("Subscription Resume Error: Stripe not configured.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    const user = req.session.user as SessionUser;
    const { stripeSubId } = req.params;

    if (!stripeSubId) {
        return res.status(400).json({ message: 'Missing subscription ID.' });
    }

    try {
        // 2. Authorization & Validation
        const localSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId, userId: user.id }
        });

        if (!localSubscription) {
            return res.status(404).json({ message: 'Subscription not found or access denied.' });
        }
        if (!localSubscription.collectionPaused) {
            return res.status(400).json({ message: 'Subscription collection is not paused.' });
        }
        // Note: We might allow resuming even if cancelAtPeriodEnd is true, 
        // as resuming collection might be desired until the cancellation date.
        // Let's allow it for now.

        // 3. Stripe API Call: Resume collection
        console.log(`Attempting Stripe resume for Sub ID: ${stripeSubId}`);
        const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubId, {
            pause_collection: null, // Setting to null resumes collection
        });
        console.log(`Stripe subscription ${stripeSubId} pause_collection removed.`);

        // 4. Database Update
        const updatedLocalSubscription = await prisma.subscription.update({
            where: { id: localSubscription.id },
            data: {
                collectionPaused: false,
                // status: updatedStripeSubscription.status // Update status if needed
            }
        });

        // 5. Response
        res.status(200).json({ 
            message: 'Subscription payment collection resumed.',
            subscription: updatedLocalSubscription
         });

    } catch (error: any) {
        console.error(`Error resuming subscription ${stripeSubId} for user ${user.id}:`, error);
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return res.status(400).json({ message: `Stripe Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Failed to resume subscription.' });
    }
});

export default router; 