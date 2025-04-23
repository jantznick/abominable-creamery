import React, { ReactNode } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';

interface AppWrapperProps {
    children: ReactNode;
}

// This component bundles all top-level context providers.
const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
    return (
        <CartProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
        </CartProvider>
    );
};

export default AppWrapper; 