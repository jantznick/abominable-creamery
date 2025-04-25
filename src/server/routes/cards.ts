import express, { Request, Response, Router, NextFunction } from 'express';
import { PrismaClient, SavedCard } from '@prisma/client';
import Stripe from 'stripe';

// Use the default export from the generated client location
import prisma from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-03-31.basil', // Update API version based on linter feedback
});

const router: Router = express.Router();

// Middleware to ensure user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    // Relies on the SessionData augmentation from auth.ts
    if (req.session && req.session.user && typeof req.session.user.id === 'number') {
        return next();
    } else {
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }
};

// Apply authentication middleware to all card routes
router.use(isAuthenticated);

// Helper function to get or create Stripe Customer ID
// TODO: Implement or move this logic to a shared utility if used elsewhere
async function getOrCreateStripeCustomer(userId: number, userEmail: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.stripeCustomerId) {
        return user.stripeCustomerId;
    }

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
        email: userEmail,
        // Add other relevant info like name if available
        // name: user.name,
        metadata: {
            databaseUserId: userId.toString(),
        },
    });

    // Update the user record with the new Stripe Customer ID
    await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
    });

    return customer.id;
}


// GET /api/cards - List saved cards
router.get('/', async (req: Request, res: Response) => {
    // isAuthenticated middleware ensures req.session.user exists
    const userId = req.session.user!.id;

    try {
        const savedCards = await prisma.savedCard.findMany({
            where: { userId: userId },
            orderBy: [
                { isDefault: 'desc' }, // Show default card first
                { createdAt: 'asc' }   // Then order by creation date
            ],
            // Select only the fields needed by the frontend
            select: {
                id: true, // Use the DB id for potential future local operations if needed
                stripePaymentMethodId: true,
                brand: true,
                last4: true,
                expMonth: true,
                expYear: true,
                isDefault: true,
            }
        });

        res.status(200).json(savedCards);
    } catch (error) {
        console.error("Error fetching saved cards:", error);
        res.status(500).json({ message: 'Failed to retrieve saved cards' });
    }
});

// POST /api/cards/setup-intent - Create a SetupIntent for adding a new card
router.post('/setup-intent', async (req: Request, res: Response) => {
    // isAuthenticated middleware ensures req.session.user exists
    const userId = req.session.user!.id;
    const userEmail = req.session.user!.email;

    try {
        // Get or create a Stripe Customer ID for the user
        const customerId = await getOrCreateStripeCustomer(userId, userEmail);

        // Create a SetupIntent
        // 'off_session' is typically used when saving a card for future use outside of a direct purchase flow.
        // 'on_session' might be used if saving during checkout.
        // For adding via profile, 'off_session' seems appropriate.
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            usage: 'off_session', // Indicate the intent is for future off-session payments
            // Add metadata to identify this specific intent source
            metadata: {
                source: 'save_card_profile', // Identify intent created for saving card from profile
                userId: userId.toString()      // Include userId for potential use in webhook
            }
        });

        // Send the client secret back to the frontend
        res.status(200).json({ clientSecret: setupIntent.client_secret });

    } catch (error) {
        console.error("Error creating SetupIntent:", error);
        // Check for Stripe-specific errors if needed
        if (error instanceof Stripe.errors.StripeError) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Failed to create setup intent' });
        }
    }
});

// DELETE /api/cards/:paymentMethodId - Delete a saved card
router.delete('/:paymentMethodId', async (req: Request, res: Response) => {
    // isAuthenticated middleware ensures req.session.user exists
    const userId = req.session.user!.id;
    const { paymentMethodId } = req.params; // Get stripePaymentMethodId from URL params

    if (!paymentMethodId) {
        return res.status(400).json({ message: 'Payment Method ID is required.' });
    }

    try {
        // 1. Find the local SavedCard record first to ensure ownership and existence
        const savedCard = await prisma.savedCard.findUnique({
            where: {
                stripePaymentMethodId: paymentMethodId,
            },
        });

        if (!savedCard) {
            return res.status(404).json({ message: 'Saved card not found.' });
        }

        if (savedCard.userId !== userId) {
            // This check ensures the user deleting the card owns it
            return res.status(403).json({ message: 'Forbidden: You do not own this card.' });
        }
        
        // 2. Detach the PaymentMethod from the Stripe Customer
        // This prevents it from being used for future charges via the customer object.
        // It might fail if the PM is already detached, which is okay.
        try {
            await stripe.paymentMethods.detach(paymentMethodId);
            console.log(`Detached Stripe PaymentMethod ${paymentMethodId}`);
        } catch (detachError: any) {
            // Log the error but continue, as we still want to remove the local record.
            // Common error: PM is already detached.
            console.warn(`Could not detach Stripe PaymentMethod ${paymentMethodId} (may already be detached): ${detachError.message}`);
        }

        // 3. Delete the local SavedCard record
        await prisma.savedCard.delete({
            where: {
                id: savedCard.id, // Delete using the primary key 'id'
            },
        });
        console.log(`Deleted local SavedCard record ${savedCard.id} (Stripe PM: ${paymentMethodId}) for user ${userId}`);

        // If the deleted card was the default, clear the default on the Stripe customer
        if (savedCard.isDefault) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.stripeCustomerId) {
                await stripe.customers.update(user.stripeCustomerId, {
                     invoice_settings: { default_payment_method: '' } // Use empty string to unset default
                });
                 console.log(`Cleared default payment method for Stripe Customer ${user.stripeCustomerId} as the default card was deleted.`);
            }
        }

        res.status(200).json({ message: 'Card deleted successfully.' });

    } catch (error) {
        console.error(`Error deleting card ${paymentMethodId} for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to delete card.' });
    }
});

// PUT /api/cards/:paymentMethodId/default - Set a card as default
router.put('/:paymentMethodId/default', async (req: Request, res: Response) => {
    // isAuthenticated middleware ensures req.session.user exists
    const userId = req.session.user!.id;
    const { paymentMethodId } = req.params; // Get stripePaymentMethodId from URL params

    if (!paymentMethodId) {
        return res.status(400).json({ message: 'Payment Method ID is required.' });
    }

    try {
        // 1. Verify the user exists and has a Stripe Customer ID
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true } // Only need the customer ID
        });

        if (!user || !user.stripeCustomerId) {
            console.error(`User ${userId} not found or has no Stripe Customer ID.`);
            // This shouldn't happen if cards were added correctly, but good to check.
            return res.status(404).json({ message: 'User or Stripe customer profile not found.' });
        }
        const customerId = user.stripeCustomerId;

        // 2. Verify the target SavedCard exists and belongs to the user
        const targetCard = await prisma.savedCard.findFirst({
            where: {
                userId: userId,
                stripePaymentMethodId: paymentMethodId
            }
        });

        if (!targetCard) {
            return res.status(404).json({ message: 'Saved card not found for this user.' });
        }

        // If it's already the default, do nothing
        if (targetCard.isDefault) {
            return res.status(200).json({ message: 'Card is already the default.' });
        }

        // 3. Use a transaction to update local defaults and Stripe default
        await prisma.$transaction(async (tx) => {
            // a) Set isDefault = false for all other cards of this user
            await tx.savedCard.updateMany({
                where: {
                    userId: userId,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            });

            // b) Set isDefault = true for the target card
            await tx.savedCard.update({
                where: {
                    id: targetCard.id, // Use the primary key
                },
                data: {
                    isDefault: true,
                },
            });

            // c) Update the Stripe Customer's default payment method
            await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
            });
        });

        console.log(`Set card ${paymentMethodId} as default for user ${userId} and Stripe customer ${customerId}`);
        res.status(200).json({ message: 'Default card updated successfully.' });

    } catch (error) {
        console.error(`Error setting card ${paymentMethodId} as default for user ${userId}:`, error);
        if (error instanceof Stripe.errors.StripeError) {
             res.status(400).json({ message: `Stripe Error: ${error.message}` });
        } else {
             res.status(500).json({ message: 'Failed to set default card.' });
        }
    }
});


export default router; 