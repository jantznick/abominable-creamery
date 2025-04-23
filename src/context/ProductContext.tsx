import React, { createContext, useContext, ReactNode } from 'react';
import { Flavor } from '../types/flavor';

interface ProductContextType {
    flavors: Flavor[];
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
    children: ReactNode;
    initialFlavors: Flavor[];
}

export const ProductProvider: React.FC<ProductProviderProps> = ({ children, initialFlavors }) => {
    // In a more complex scenario, you might have state setters here
    // For now, we just provide the initial data fetched server-side
    const value = { flavors: initialFlavors };

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};

export const useProducts = (): ProductContextType => {
    const context = useContext(ProductContext);
    if (context === undefined) {
        throw new Error('useProducts must be used within a ProductProvider');
    }
    return context;
}; 