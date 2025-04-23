export interface PriceOption {
    priceId: string;         // Stripe Price ID
    price: string;           // Formatted price string
    currency: string;
    packSize: string | null; // e.g., 'single', '3-pack' (from Price metadata)
    unitDescription: string | null; // e.g., 'Pint', '3-Pack' (from Price metadata)
    displayName: string | null; // New: Display name from Price metadata
    isDefault: boolean;         // New: Flag indicating if this is the default price for the product
}

export interface Flavor {
    id: string;              // Stripe Product ID
    name: string;            // Stripe Product Name
    simpleName: string;      // From Product metadata
    description: string | null; // Stripe Product Description
    hasDairy: boolean;
    hasEgg: boolean;
    withoutDairy: boolean;
    withoutEgg: boolean;
    imageSrc: string | null; // URL from Stripe Product images[0]
    prices: PriceOption[];   // Array of available prices/packs
    slug: string | null;     // New: Slug from Product metadata
} 