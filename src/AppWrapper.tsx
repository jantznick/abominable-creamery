import React, { ReactNode } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

interface AppWrapperProps {
    children: ReactNode;
}

// This component bundles all top-level context providers.
const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
    return (
        <CartProvider>
            <Toaster 
                position="bottom-right" 
                toastOptions={{
                    // Define default options
                    className: '',
                    duration: 5000, // Default duration
                    style: {
                        background: '#333', // Default background (can be overridden)
                        color: '#fff',    // Default text color
                    },
                    // Define options for specific types
                    success: {
                        duration: 3000,
                        style: {
                            background: '#f59e0b', // Amber-600 equivalent
                            color: 'white',
                        },
                        iconTheme: {
                            primary: 'white',
                            secondary: '#f59e0b' // Match background
                        }
                    },
                    error: {
                         style: {
                            background: '#dc2626', // Red-600 equivalent
                            color: 'white',
                        },
                        iconTheme: {
                            primary: 'white',       
                            secondary: '#dc2626' // Match background
                        }
                    }
                }}
            />
            <AuthProvider>
                {children}
            </AuthProvider>
        </CartProvider>
    );
};

export default AppWrapper; 