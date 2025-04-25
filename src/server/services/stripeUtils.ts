import Stripe from 'stripe';

// Helper function to fetch image URLs for multiple product IDs concurrently
// Requires the initialized Stripe instance to be passed in
export async function getImageUrls(
    stripe: Stripe, // Pass the initialized Stripe client
    productIds: string[]
): Promise<{ [productId: string]: string | null }> {
    const imageUrlMap: { [productId: string]: string | null } = {};

    if (!stripe || !productIds || productIds.length === 0) {
        return imageUrlMap;
    }

    try {
        const productPromises = productIds.map(async (id) => {
            try {
                const stripeProduct = await stripe.products.retrieve(id);
                return { id, imageUrl: stripeProduct?.images?.[0] || null };
            } catch (prodError: any) {
                console.warn(`Could not fetch Stripe product ${id}: ${prodError.message}`);
                // Return null image URL for this ID on error
                return { id, imageUrl: null };
            }
        });

        const results = await Promise.all(productPromises);

        results.forEach(result => {
            imageUrlMap[result.id] = result.imageUrl;
        });

    } catch (error) {
        console.error("Error fetching product images in bulk:", error);
        // Optionally, return an empty map or re-throw, depending on desired handling
    }

    return imageUrlMap;
}

// Potential place to move Stripe client initialization later
// export const stripeClient = ...; 