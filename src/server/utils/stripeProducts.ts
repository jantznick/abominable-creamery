import Stripe from 'stripe';
import { Flavor, PriceOption } from '../../types/flavor'; // Adjust path as needed

// Helper to convert Stripe metadata string ('true'/'false') to boolean
const parseBooleanMetadata = (metadataValue: string | undefined): boolean => {
    return metadataValue === 'true';
};

// Helper to format price (Stripe amounts are in cents)
const formatPrice = (amount: number | null, currency: string): string => {
    if (amount === null) return '0.00'; // Or handle as error/unavailable
    const value = (amount / 100).toFixed(2);
    // Basic formatting, consider Intl.NumberFormat for more robust localization
    // return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount / 100);
    return value; // Keep simple string format matching original content.ts
};

/**
 * Fetches active products and all their active prices from Stripe 
 * and maps them to the Flavor interface.
 * 
 * @param stripe The initialized Stripe instance.
 * @returns A promise that resolves to an array of Flavors.
 */
export const getStripeProducts = async (stripe: Stripe): Promise<Flavor[]> => {
    try {
        // 1. Fetch active products
        const products = await stripe.products.list({
            active: true,
            // Don't expand default_price anymore, fetch all prices separately
        });

        // 2. Fetch prices for each product and map
        const flavorPromises = products.data.map(async (product): Promise<Flavor | null> => {
            // 3. Fetch all active prices for this product
            const prices = await stripe.prices.list({
                product: product.id,
                active: true,
            });

            // Skip product if it has no active prices
            if (prices.data.length === 0) {
                console.warn(`Product ${product.id} (${product.name}) has no active prices. Skipping.`);
                return null;
            }

            // 4. Map prices to PriceOption structure
            const priceOptions: PriceOption[] = prices.data.map((price) => ({
                priceId: price.id,
                price: formatPrice(price.unit_amount, price.currency),
                currency: price.currency,
                packSize: price.metadata?.packSize || null,
                unitDescription: price.metadata?.unitDescription || null,
                displayName: price.metadata?.displayName || null,
                isDefault: product.default_price === price.id
            }));

            // 5. Construct the Flavor object
            const flavor: Flavor = {
                id: product.id,
                name: product.name,
                simpleName: product.metadata?.simpleName || product.name,
                description: product.description || null,
                hasDairy: parseBooleanMetadata(product.metadata?.hasDairy),
                hasEgg: parseBooleanMetadata(product.metadata?.hasEgg),
                withoutDairy: parseBooleanMetadata(product.metadata?.withoutDairy),
                withoutEgg: parseBooleanMetadata(product.metadata?.withoutEgg),
                imageSrc: product.images?.length > 0 ? product.images[0] : null,
                prices: priceOptions, // Assign the array of mapped prices
                slug: product.metadata?.slug || null // Get slug from metadata
            };
            return flavor;
        });

        // Wait for all price fetching and mapping to complete
        const resolvedFlavors = await Promise.all(flavorPromises);

        // Filter out any nulls (products skipped due to no prices)
        const validFlavors = resolvedFlavors.filter((flavor): flavor is Flavor => flavor !== null);

        return validFlavors;

    } catch (error) {
        console.error("Error fetching products or prices from Stripe:", error);
        // Depending on how critical products are, you might re-throw, 
        // return an empty array, or handle differently.
        return []; 
    }
}; 