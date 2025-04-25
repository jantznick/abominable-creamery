import { Decimal } from '@prisma/client/runtime/library';
import { Order, OrderItem } from '@prisma/client';
import { CartItem } from '../../../src/context/CartContext'; // Adjust path as needed

// Define expected type for /initiate-checkout request body
export interface InitiateCheckoutRequest {
    items: CartItem[];
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
    notes?: string; // Add optional notes field
    selectedCardId?: string; // Optional: PM ID if paying with saved card
    saveNewCardForFuture?: boolean; // Optional: Flag to save new card
}

// Define a type for the Order fetched with selected items for API responses
export type FetchedOrder = Order & {
    items: Array<Pick<OrderItem, 'id' | 'productId' | 'productName' | 'quantity' | 'price'>>;
};

// Define a type for the augmented order item including image URL for API responses
export interface OrderItemWithImage {
    id: number;
    productId: string;
    productName: string;
    quantity: number;
    price: Decimal; // Prisma Decimal type
    imageUrl: string | null;
} 