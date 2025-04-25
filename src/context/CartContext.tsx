import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast'; // Import toast

// --- Types ---

// Updated CartItem type to include productId and slug
export interface CartItem {
    priceId: string;    // Stripe Price ID (unique identifier for the cart item)
    productId: string;  // Stripe Product ID
    slug: string | null; // Slug for linking
    name: string;       // Name of the item (including pack description, e.g., "Vanilla (Pint)")
    productName?: string; // <-- Add this field to align with metadata 
    price: string;      // Price per unit (string format, e.g., "5.99")
    quantity: number;   // Number of units in the cart
    imageSrc?: string;  // Optional image source (product image)
    isSubscription?: boolean; // New: Optional flag for subscriptions
    recurringInterval?: string | null; // New: Optional interval if subscription
}

// Update payload to include productId and slug
export interface AddItemPayload {
    priceId: string;
    productId: string;
    slug: string | null;
    name: string;
    price: string; 
    imageSrc?: string;
    isSubscription?: boolean; // New: Optional flag for subscriptions
    recurringInterval?: string | null; // New: Optional interval if subscription
}

interface CartContextState {
    items: CartItem[];
    addItem: (itemToAdd: AddItemPayload, quantity?: number) => void;
    removeItem: (priceId: string) => void; // Use priceId
    updateQuantity: (priceId: string, quantity: number) => void; // Use priceId
    clearCart: () => void;
    getCartTotal: () => number;
    getItemCount: () => number;
}

// --- Constants ---
const LOCAL_STORAGE_KEY = 'abominableCreameryCartItems_v4'; // Update key again

// --- Context ---
const CartContext = createContext<CartContextState | undefined>(undefined);

// --- Helper Function to safely get initial state ---
const getInitialState = (): CartItem[] => {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const storedItems = window.localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedItems) {
                const parsedItems = JSON.parse(storedItems);
                // Update validation to check for slug (allow null)
                if (Array.isArray(parsedItems) && parsedItems.every(item => 
                    item && 
                    typeof item.priceId === 'string' &&
                    typeof item.productId === 'string' &&
                    (typeof item.slug === 'string' || item.slug === null) // Check slug
                )) {
                    return parsedItems;
                }
                console.warn("Invalid v4 cart data found in localStorage, resetting.");
                window.localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        } catch (error) {
            console.error("Error reading v4 cart items from localStorage:", error);
            // window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }
    return []; 
};

// --- Provider Component ---
interface CartProviderProps {
    children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>(getInitialState);

    // Effect to save state to localStorage whenever items change
    useEffect(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
            } catch (error) {
                console.error("Error saving cart items to localStorage:", error);
            }
        }
    }, [items]); 

    // Add item to cart
    const addItem = (itemToAdd: AddItemPayload, quantity: number = 1) => {
        let itemAddedName = itemToAdd.name; // Store name for toast message
        setItems(prevItems => {
            const existingItem = prevItems.find(item => item.priceId === itemToAdd.priceId);
            if (existingItem) {
                // Update name for toast if item already exists
                itemAddedName = existingItem.name;
                return prevItems.map(item =>
                    item.priceId === itemToAdd.priceId
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            } else {
                const newItem: CartItem = {
                    priceId: itemToAdd.priceId,
                    productId: itemToAdd.productId, 
                    slug: itemToAdd.slug,
                    name: itemToAdd.name,
                    price: itemToAdd.price,
                    quantity: quantity,
                    imageSrc: itemToAdd.imageSrc,
                    isSubscription: itemToAdd.isSubscription,
                    recurringInterval: itemToAdd.recurringInterval,
                };
                 // itemAddedName is already set correctly for new items
                return [...prevItems, newItem];
            }
        });
        // Display toast notification
        toast.success(`${quantity} x ${itemAddedName} added to cart!`);
        console.log("Added item (Price ID):", itemToAdd.priceId, "Product ID:", itemToAdd.productId, "Slug:", itemToAdd.slug, "Quantity:", quantity);
    };

    // Remove item from cart (using priceId)
    const removeItem = (priceId: string) => {
        setItems(prevItems => prevItems.filter(item => item.priceId !== priceId));
        console.log("Removed item (Price ID):", priceId);
    };

    // Update item quantity (using priceId)
    const updateQuantity = (priceId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(priceId);
        } else {
            setItems(prevItems =>
                prevItems.map(item =>
                    item.priceId === priceId ? { ...item, quantity } : item
                )
            );
             console.log("Updated quantity for (Price ID):", priceId, "New Quantity:", quantity);
        }
    };

    // Clear all items from cart
    const clearCart = () => {
        setItems([]);
         console.log("Cart cleared");
    };

    // Calculate total price of items in cart (parsing price string)
    const getCartTotal = useMemo(() => {
        return () => items.reduce((total, item) => {
            const priceValue = parseFloat(item.price);
            if (isNaN(priceValue)) {
                console.error(`Invalid price format for item ${item.priceId}: ${item.price}`);
                return total; // Skip item if price is invalid
            }
            return total + priceValue * item.quantity;
        }, 0);
    }, [items]);

    // Get total number of individual items in the cart
    const getItemCount = useMemo(() => {
        return () => items.reduce((count, item) => count + item.quantity, 0);
    }, [items]);

    // Memoize the context value
     const contextValue = useMemo(() => ({
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getCartTotal,
        getItemCount
    }), [items, getCartTotal, getItemCount]);

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
};

// --- Custom Hook ---
export const useCart = (): CartContextState => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}; 