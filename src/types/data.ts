// src/types/data.ts

// User details potentially included in API responses
export interface ApiUser { 
    id: number;
    email: string;
    name: string | null;
    phone: string | null; // Add optional phone field
    // Add role if needed for client-side logic differentiation
    role?: 'USER' | 'ADMIN';
    createdAt: string;
    updatedAt: string;
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

// Structure for a saved address from API
export interface Address {
  id: number;
  userId: number;
  type: 'SHIPPING' | 'BILLING';
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string; // Or Date, depending on API response serialization
  updatedAt: string; // Or Date
}

// Structure for submitting address form data (POST/PUT)
export type AddressFormData = Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

// Represents the structure for an Address from the API
// Should align with the Prisma Address model
export interface ApiAddress {
    id: number;
    userId: number;
    type: 'SHIPPING' | 'BILLING';
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
    createdAt: string; 
    updatedAt: string;
}

// Simplified Product representation for frontend use
export interface Product {
    id: string;       // Flavor ID (e.g., 'classic-vanilla')
    name: string;
    description: string;
    price: number;    // Price as a number for calculations
    imageUrl: string;
    category: string; // e.g., 'Classic Flavors', 'Seasonal'
    tags?: string[];  // Optional tags like 'New', 'Fan Favorite'
    // Add other relevant fields as needed (e.g., allergens, stock count)
}

// Structure for items within a shopping cart
export interface CartItem extends Product {
    quantity: number;
}

// Structure for items within an order (similar to cart, but price is fixed)
export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number; // Price *per item* at the time of order
}

// Represents the structure for an Order from the API
export interface ApiOrder {
    id: number;
    userId: number | null; // Nullable for guest orders
    totalAmount: string; // Typically decimal/money is stringified
    status: 'PENDING' | 'PAID' | 'SHIPPED' | 'FAILED';
    contactEmail: string;
    contactPhone: string | null;
    shippingName: string;
    shippingAddress1: string;
    shippingAddress2: string | null;
    shippingCity: string;
    shippingState: string;
    shippingPostalCode: string;
    shippingCountry: string;
    items: OrderItem[];
    createdAt: string;
    updatedAt: string;
} 