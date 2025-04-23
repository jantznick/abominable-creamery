// src/types/data.ts

// User details potentially included in API responses
export interface ApiUser { 
    id: number;
    email: string;
    name: string | null;
    // Add role if needed for client-side logic differentiation
    role?: 'USER' | 'ADMIN';
}

// Structure for individual items within an order from API
export interface OrderItemData {
    id: number;
    productId: string;
    productName: string;
    quantity: number;
    price: number | string; // Price might be string if Decimal comes as string
    imageUrl?: string; // Optional: Add image URL field
}

// Structure for a complete order from API
export interface OrderData {
    id: number;
    userId: number | null; // Can be null for guest orders
    user?: ApiUser | null; // User details included in admin view
    totalAmount: number | string; 
    status: string; 
    createdAt: string; 
    items: OrderItemData[];
    // Contact/Shipping Info
    contactEmail: string | null; // Nullable for registered users?
    shippingName: string | null;
    // Added standard shipping address fields (optional)
    shippingAddress1?: string | null;
    shippingAddress2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingZip?: string | null;
    shippingCountry?: string | null; // Added country just in case
} 