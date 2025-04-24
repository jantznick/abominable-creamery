import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
// Removed Stripe imports as status check is now backend-driven
// import { loadStripe, Stripe } from '@stripe/stripe-js';
import { AddressFormData } from '../types/data'; // Import address form data type

// Removed stripePromise initialization

// Interface for the data expected from sessionStorage
// Should match the CheckoutData interface defined in Checkout.tsx
// --- Updated interface (matching Checkout.tsx and backend expectations) ---
interface CheckoutDataForConfirmation {
    items: { 
        // Expect productId, as saved by Checkout.tsx and expected by backend
        productId: string; 
        productName: string; 
        quantity: number;
        price: number; // Price in dollars
        isSubscription?: boolean; // Make sure this is included if checking!
    }[];
    totalAmount: number; // Total in dollars
    shippingAddress: { 
        fullName: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    contactInfo: { 
        email: string;
        phone?: string;
    };
    shouldSaveAddress?: boolean; // Add the optional flag
}

export const OrderConfirmation = () => {
    const [searchParams] = useSearchParams();
    const { clearCart } = useCart();
    // Removed stripeInstance state
    const [message, setMessage] = useState<string | null>('Loading confirmation details...');
    const [isLoading, setIsLoading] = useState(true);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    // Removed hasFetched state as useEffect dependencies handle it
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null); // State for order creation errors
    // Removed purchasedSubscription state, can infer from URL param if needed

    // State to store retrieved checkoutAttemptId
    const [retrievedCheckoutAttemptId, setRetrievedCheckoutAttemptId] = useState<string | null>(null);
    // Removed isSubscriptionCheckout state

    // Get Payment Intent ID from URL
    const paymentIntentId = searchParams.get('payment_intent');
    const redirectStatus = searchParams.get('redirect_status'); // Stripe might include this

    // --- Effect 1: Retrieve Checkout Attempt ID and Clear Session Storage --- 
    useEffect(() => {
        console.log("Order Confirmation: Attempting to retrieve checkoutAttemptId...");
        let attemptId: string | null = null;
        try {
            // Read the ID string directly
            attemptId = sessionStorage.getItem('checkoutDataForConfirmation');
            if (attemptId) {
                setRetrievedCheckoutAttemptId(attemptId);
                console.log(`Order Confirmation: Retrieved checkoutAttemptId: ${attemptId}`);
                sessionStorage.removeItem('checkoutDataForConfirmation'); 
                console.log("Order Confirmation: Cleared checkout data key from sessionStorage.");
            } else {
                console.warn("Order Confirmation: checkoutAttemptId not found in session storage.");
                // If the ID is missing, we likely can't proceed correctly, especially for PI.
                // The second effect will handle missing intent IDs, but this might be an issue.
            }
        } catch (error: any) {
            console.error("Order Confirmation: Error retrieving checkoutAttemptId from storage:", error);
            // Set error? Depends on how critical missing ID is vs. missing intent ID.
        }
    }, []); // Empty dependency array ensures this runs only once

    // --- Effect 2: Check Intent Status --- 
    useEffect(() => {
        const paymentIntentId = searchParams.get('payment_intent');
        const setupIntentId = searchParams.get('setup_intent');
        const redirectStatus = searchParams.get('redirect_status');

        // Removed dependency/check on retrievedCheckoutData

        // Decide flow based on URL params
        if (setupIntentId) {
            // --- Handle Setup Intent Flow (Subscriptions) --- 
            // (No changes needed here - logic is based on redirectStatus)
            console.log(`Order Confirmation: Handling SetupIntent ${setupIntentId} with redirect_status: ${redirectStatus}`);
            setIsLoading(true); 
            setMessage('Processing subscription setup...');

            if (redirectStatus === 'succeeded') {
                setMessage('Your payment method was saved successfully! Your subscription is being finalized via webhook and will appear in your account shortly.');
                setIsSuccess(true); 
                setIsLoading(false);
            } else {
                setMessage(`There was an issue setting up your payment method (${redirectStatus}). Please try again or contact support.`);
                setIsSuccess(false);
                setIsLoading(false);
            }

        } else if (paymentIntentId) {
            // --- Handle Payment Intent Flow (One-Time Purchases) ---
            console.log(`Order Confirmation: Handling PaymentIntent ${paymentIntentId}`);
            setIsLoading(true);
            setOrderError(null);
            setMessage('Verifying payment...'); 

            // Fetch PI status from backend
            fetch(`/api/stripe/payment-intent/${paymentIntentId}`)
                .then(async (res) => {
                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw new Error(errorData.error || `Server error: ${res.status}`);
                    }
                    return res.json();
                })
                .then((data) => {
                    console.log("Order Confirmation: Received payment intent data:", data);
                    
                    switch (data.status) {
                        case 'succeeded':
                            // PI succeeded client-side. Order creation now handled by webhook.
                            // Just update the message.
                            setMessage('Payment successful! Your order is being processed and confirmed via webhook.');
                            setIsSuccess(true);
                            // --- REMOVED Order creation fetch call --- 
                            /* 
                            if (!retrievedCheckoutData) { ... } // No longer needed
                            console.log("Creating order..."); 
                            const orderPayload = { ... }; 
                            fetch('/api/orders', ...) ... 
                            */
                           setIsLoading(false); // Set loading false immediately after success status check
                            break; 
                        case 'processing':
                            setMessage("Your payment is processing...");
                            setIsSuccess(null);
                            setIsLoading(false); 
                            break;
                        case 'requires_payment_method':
                            setMessage('Payment failed. Please try another payment method.');
                            setIsSuccess(false);
                            setIsLoading(false); 
                            break;
                        default:
                            setMessage('Unhandled payment status. Please contact support.');
                            setIsSuccess(false);
                            setIsLoading(false); 
                            break;
                    }
                })
                .catch(error => {
                    console.error("Error fetching payment status:", error);
                    setMessage(error.message || "Failed to retrieve payment status.");
                    setIsSuccess(false);
                    setIsLoading(false);
                });
        } else {
            // --- No Intent ID Found --- 
            console.error("Order Confirmation: Missing payment_intent OR setup_intent in URL.");
            setMessage("Error: Required payment information is missing from the URL.");
            setIsSuccess(false);
            setIsLoading(false);
        }

    // Removed retrievedCheckoutData from dependency array
    }, [searchParams]); 

    // --- Effect 3: Clear Cart on Success (No changes needed) --- 
    useEffect(() => {
        if (isSuccess === true) {
            console.log("Order Confirmation: Clearing cart due to success state.");
            clearCart();
        }
    }, [isSuccess, clearCart]); 

    // --- REMOVED Effect 4: Save Address --- 
    // This must now be handled server-side by the webhook after retrieving context
    /*
    useEffect(() => {
        if (isSuccess === true && retrievedCheckoutData?.shouldSaveAddress === true ...) { ... }
    }, [isSuccess, retrievedCheckoutData]);
    */

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-16">
                    <div className="spinner border-t-4 border-indigo-500 border-solid rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
                    <p className="text-xl text-slate-600">{message || 'Loading...'}</p>
                </div>
            );
        }

        // Use orderError state for specific order creation failures
        if (orderError) {
             return (
                <div className="text-center py-16">
                    <span className="material-symbols-outlined text-7xl text-red-500 mb-4">error</span>
                    <p className="text-xl md:text-2xl font-semibold mb-8 text-red-700">{orderError}</p>
                    <div className="flex justify-center space-x-4">
                        <Link
                            to="/flavors"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            );
        }

        // General success/failure rendering based on isSuccess and message
        return (
            <div className="text-center py-16">
                {isSuccess === true && (
                    <span className="material-symbols-outlined text-7xl text-emerald-500 mb-4">check_circle</span>
                )}
                {isSuccess === false && (
                     <span className="material-symbols-outlined text-7xl text-red-500 mb-4">error</span>
                )}
                <p className={`text-xl md:text-2xl font-semibold mb-8 ${isSuccess === false ? 'text-red-700' : 'text-slate-800'}`}>
                    {message || (isSuccess === false ? 'An unknown error occurred.' : 'Processing...')}
                </p>

                 {/* --- REMOVED Order Summary --- */}
                 {/* 
                 {retrievedCheckoutData && (
                     <div className="max-w-md mx-auto ..."> ... </div>
                 )}
                 */}

                <div className="flex justify-center space-x-4">
                    {isSuccess === true && (
                         <Link
                             to="/profile" 
                             className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
                         >
                             View Account
                         </Link>
                    )}
                    <Link
                        to="/flavors"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <div className='grow container mx-auto px-4 py-8 md:py-16'>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">Order Status</h1>
            <div className="bg-white p-6 md:p-10 rounded-lg shadow-md border border-slate-200">
                {renderContent()}
            </div>
        </div>
    );
}; 