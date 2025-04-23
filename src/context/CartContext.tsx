import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';

// --- Types ---

export interface CartItem {
    id: string;         // Unique identifier for the item (e.g., flavor id)
    name: string;       // Name of the item
    price: number;      // Price per unit
    quantity: number;   // Number of units in the cart
    imageSrc?: string;  // Optional image source
}

interface CartContextState {
    items: CartItem[];
    addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
    getItemCount: () => number;
}

// --- Constants ---
const LOCAL_STORAGE_KEY = 'abominableCreameryCartItems';

// --- Context ---

// Create context with a default value (can be undefined or a default state)
const CartContext = createContext<CartContextState | undefined>(undefined);

// --- Helper Function to safely get initial state ---
const getInitialState = (): CartItem[] => {
    // Check if running on client side
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const storedItems = window.localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedItems) {
                // TODO: Add validation here later if needed
                return JSON.parse(storedItems);
            }
        } catch (error) {
            console.error("Error reading cart items from localStorage:", error);
            // Optionally clear corrupted storage
            // window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }
    return []; // Return empty array if server-side or no stored data
};

// --- Provider Component ---

interface CartProviderProps {
    children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
    // Initialize state from localStorage helper function
    const [items, setItems] = useState<CartItem[]>(getInitialState);

    // Effect to save state to localStorage whenever items change
    useEffect(() => {
        // Check if running on client side
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
            } catch (error) {
                console.error("Error saving cart items to localStorage:", error);
            }
        }
    }, [items]); // Re-run this effect whenever items array changes

    // Add item to cart (or increment quantity if it exists)
    const addItem = (itemToAdd: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
        setItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === itemToAdd.id);
            if (existingItem) {
                // Increment quantity
                return prevItems.map(item =>
                    item.id === itemToAdd.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            } else {
                // Add new item
                return [...prevItems, { ...itemToAdd, quantity }];
            }
        });
        console.log("Added item:", itemToAdd, "Quantity:", quantity);
    };

    // Remove item from cart
    const removeItem = (itemId: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        console.log("Removed item:", itemId);
    };

    // Update item quantity (remove if quantity <= 0)
    const updateQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(itemId);
        } else {
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === itemId ? { ...item, quantity } : item
                )
            );
             console.log("Updated quantity for:", itemId, "New Quantity:", quantity);
        }
    };

    // Clear all items from cart
    const clearCart = () => {
        setItems([]);
         console.log("Cart cleared");
    };

    // Calculate total price of items in cart
    const getCartTotal = useMemo(() => {
        return () => items.reduce((total, item) => total + item.price * item.quantity, 0);
    }, [items]);

    // Get total number of individual items in the cart
    const getItemCount = useMemo(() => {
        return () => items.reduce((count, item) => count + item.quantity, 0);
    }, [items]);


    // Memoize the context value to prevent unnecessary re-renders
     const contextValue = useMemo(() => ({
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getCartTotal,
        getItemCount
    }), [items, getCartTotal, getItemCount]); // Dependencies for useMemo


    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
};

// --- Custom Hook ---

// Custom hook to use the CartContext, ensures it's used within a provider
export const useCart = (): CartContextState => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}; 