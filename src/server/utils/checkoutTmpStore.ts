import prisma from '../db';
import crypto from 'crypto';
import { CartItem } from '../../context/CartContext'; // Reusing frontend type

// Define the structure of the data we expect to store
// This should match the data constructed in /api/stripe/initiate-checkout
interface CheckoutContext {
    userId: number | null;
    cartItems: any[]; // Use a more specific type if possible, mirroring detailedCartItems
    contactInfo: { email: string; phone?: string };
    shippingAddress: {
        fullName: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
}

/**
 * Saves the checkout context to the temporary CheckoutAttempt table.
 * @param data The checkout context data.
 * @returns The unique ID (checkoutAttemptId) for the stored attempt.
 */
export const saveCheckoutAttempt = async (data: CheckoutContext): Promise<string> => {
    const checkoutAttemptId = crypto.randomUUID();
    console.log(`Generating CheckoutAttempt ID: ${checkoutAttemptId}`);

    try {
        await prisma.checkoutAttempt.create({
            data: {
                id: checkoutAttemptId,
                data: data as any, // Prisma expects JsonValue, cast for now
            },
        });
        console.log(`Saved CheckoutAttempt ${checkoutAttemptId} to database.`);
        return checkoutAttemptId;
    } catch (error) {
        console.error(`Error saving CheckoutAttempt ${checkoutAttemptId}:`, error);
        // Re-throw the error to be handled by the calling route
        throw new Error('Failed to save checkout attempt data.');
    }
};

/**
 * Retrieves the checkout context from the temporary CheckoutAttempt table.
 * @param id The checkoutAttemptId.
 * @returns The parsed checkout context data, or null if not found.
 */
export const getCheckoutAttempt = async (id: string): Promise<CheckoutContext | null> => {
    try {
        const attempt = await prisma.checkoutAttempt.findUnique({
            where: { id },
        });

        if (!attempt) {
            console.log(`CheckoutAttempt ${id} not found.`);
            return null;
        }

        // Prisma returns the Json field directly, needs type assertion
        const contextData = attempt.data as unknown as CheckoutContext;
        console.log(`Retrieved CheckoutAttempt ${id} from database.`);
        return contextData;
    } catch (error) {
        console.error(`Error retrieving CheckoutAttempt ${id}:`, error);
        // Return null or throw, depending on desired error handling for webhook
        return null; 
    }
};

/**
 * Deletes a checkout attempt record from the temporary table.
 * @param id The checkoutAttemptId to delete.
 */
export const deleteCheckoutAttempt = async (id: string): Promise<void> => {
    try {
        await prisma.checkoutAttempt.delete({
            where: { id },
        });
        console.log(`Deleted CheckoutAttempt ${id} from database.`);
    } catch (error: any) {
        // Log error but don't necessarily throw, deletion failure might not be critical for response
        // Check for specific Prisma error code if record not found (P2025)
        if (error.code === 'P2025') {
            console.warn(`Attempted to delete CheckoutAttempt ${id}, but it was not found.`);
        } else {
             console.error(`Error deleting CheckoutAttempt ${id}:`, error);
        }
    }
}; 