import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
// Removed Stripe imports as status check is now backend-driven
// import { loadStripe, Stripe } from '@stripe/stripe-js';
import { AddressFormData } from '../types/data'; // Import address form data type
// Import OrderData type for fetched details
import { OrderData } from '../types/data';
// Import the new components
import { ConfirmationStatusIcon } from '../components/confirmation/ConfirmationStatusIcon';
import { ConfirmationMessage } from '../components/confirmation/ConfirmationMessage';
import { OrderSummaryDisplay } from '../components/confirmation/OrderSummaryDisplay';
import { ActionButtons } from '../components/confirmation/ActionButtons';

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
    // State to store fetched order details from backend API
    const [fetchedOrderDetails, setFetchedOrderDetails] = useState<OrderData | null>(null);
    // State to track the type of confirmation for UI elements
    const [confirmationType, setConfirmationType] = useState<'subscription' | 'order' | null>(null);

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

    // --- Effect 2: Check Intent Status & Fetch Order Details --- 
    useEffect(() => {
        const paymentIntentId = searchParams.get('payment_intent');
        const setupIntentId = searchParams.get('setup_intent');
        const redirectStatus = searchParams.get('redirect_status');

        // Removed dependency/check on retrievedCheckoutData

        // Decide flow based on URL params
        if (setupIntentId) {
            // --- Handle Setup Intent Flow (Subscriptions) --- 
            console.log(`Order Confirmation: Handling SetupIntent ${setupIntentId} with redirect_status: ${redirectStatus}`);
            setIsLoading(true); 
            // Initial message while we check status/fetch
            setMessage('Processing subscription setup...');
            setConfirmationType('subscription'); // Assume subscription type

            if (redirectStatus === 'succeeded') {
                // Setup intent succeeded client-side. Set success state immediately.
                setIsSuccess(true);
                setMessage('Payment method saved! Fetching final confirmation details...');
                
                // Attempt to fetch order details even on success, as webhook might be fast
                fetch(`/api/stripe/setup-intent/${setupIntentId}`)
                    .then(res => res.ok ? res.json() : Promise.resolve({ orderDetails: null })) // Resolve gracefully if fetch fails
                    .then(data => {
                        if (data.orderDetails) {
                            setFetchedOrderDetails(data.orderDetails);
                            setMessage('Subscription confirmed! Your order details are below.'); // More specific message
                        } else {
                            // If details not found yet, stick to the generic message
                            setMessage('Your payment method was saved successfully! Your subscription is being finalized and will appear in your account shortly.');
                            console.log(`SI ${setupIntentId} succeeded, but order details not yet found via API.`);
                        }
                    })
                    .catch(err => {
                        // Log error but keep generic success message
                        console.error("Error fetching setup intent details even after success redirect:", err);
                         setMessage('Your payment method was saved successfully! Your subscription is being finalized and will appear in your account shortly.');
                    })
                    .finally(() => setIsLoading(false)); // Set loading false after fetch attempt

            } else {
                // Fetch SI status for more detailed error message
                 setMessage(`Hold on, checking the status of your setup...`);
                 fetch(`/api/stripe/setup-intent/${setupIntentId}`)
                    .then(res => res.ok ? res.json() : Promise.reject(new Error(`Setup intent check failed: ${res.statusText}`))) 
                    .then(data => {
                         // Even on failure, webhook might have run, so check for details
                         if (data.orderDetails) setFetchedOrderDetails(data.orderDetails);
                         // Construct a more informative error message if possible
                         let errorMsg = `There was an issue setting up your payment method (Status: ${data.stripeStatus || redirectStatus || 'unknown'}). Please try again or contact support.`;
                         if (data.stripeStatus === 'requires_payment_method') {
                            errorMsg = 'Setup failed: Invalid payment method. Please update your payment details.'
                         }
                         setMessage(errorMsg);
                         setIsSuccess(false);
                         setConfirmationType(null);
                    })
                    .catch(err => {
                         console.error("Error fetching setup intent status:", err);
                         setMessage(`There was an issue setting up your payment method (${redirectStatus || 'unknown'}). Please try again or contact support.`);
                         setIsSuccess(false);
                         setConfirmationType(null);
                    })
                    .finally(() => setIsLoading(false));
            }

        } else if (paymentIntentId) {
            // --- Handle Payment Intent Flow (One-Time Purchases) ---
            console.log(`Order Confirmation: Handling PaymentIntent ${paymentIntentId}`);
            setIsLoading(true);
            setOrderError(null);
            setMessage('Verifying payment and retrieving order details...'); 
            setConfirmationType('order'); // Assume order type

            // Fetch PI status AND order details from enhanced backend endpoint
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
                    setFetchedOrderDetails(data.orderDetails || null); // Store order details if returned
                    
                    switch (data.stripeStatus) { // Check the renamed status field
                        case 'succeeded':
                            if (data.orderDetails) {
                                setMessage(`Payment successful! Your order #${data.orderDetails.id} is confirmed.`);
                            } else {
                                // PI succeeded, but webhook might be slow or failed to find order via attemptId
                                setMessage('Payment successful! Your order is being finalized and confirmed via webhook.');
                                console.warn(`PI ${paymentIntentId} succeeded, but order details not found (using checkoutAttemptId: ${retrievedCheckoutAttemptId})`);
                            }
                            setIsSuccess(true);
                            // setConfirmationType('order'); // Already set above
                            break; 
                        case 'processing':
                            setMessage("Your payment is processing. We'll confirm your order once payment is complete.");
                            setIsSuccess(null); 
                            setConfirmationType(null); // Reset type if not confirmed
                            break;
                        case 'requires_payment_method':
                            setMessage('Payment failed. Please try another payment method.');
                            setOrderError('Payment was not successful. Please check your payment details or try a different method.'); // Set specific error
                            setIsSuccess(false);
                            setConfirmationType(null);
                            break;
                        default:
                             setMessage(`Payment status: ${data.stripeStatus}. Please contact support if this persists.`);
                             setOrderError('An unexpected payment status occurred. Please contact support.'); // Set specific error
                            setIsSuccess(false);
                            setConfirmationType(null);
                            break;
                    }
                })
                .catch(error => {
                    console.error("Error fetching payment status:", error);
                    setMessage(error.message || "Failed to retrieve payment status.");
                    setOrderError(error.message || "An error occurred while checking your payment status."); // Set specific error
                    setIsSuccess(false);
                    setConfirmationType(null);
                })
                .finally(() => {
                     setIsLoading(false);
                });
        } else {
            // --- No Intent ID Found --- 
            console.error("Order Confirmation: Missing payment_intent OR setup_intent in URL.");
            setMessage("Error: Required payment information is missing from the URL.");
            setOrderError("Could not find payment information to confirm your order."); // Set specific error
            setIsSuccess(false);
            setIsLoading(false);
            setConfirmationType(null);
        }

    // Removed retrievedCheckoutData from dependency array
    }, [searchParams]); 

    // --- Effect 3: Clear Cart on Success --- 
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

    // --- Refactored renderContent --- 
    const renderContent = () => {
        // Display loading spinner first
        if (isLoading) {
             return (
                <div className="text-center py-16">
                     <ConfirmationStatusIcon isLoading={true} isSuccess={null} orderError={null} />
                     <p className="text-xl text-slate-600">{message || 'Loading...'}</p>
                </div>
            );
        }

        return (
            <div className="text-center py-10 px-4 sm:px-6 lg:px-8">
                {/* Status Icon */}
                <ConfirmationStatusIcon isLoading={isLoading} isSuccess={isSuccess} orderError={orderError} />
                
                {/* Message */}
                <ConfirmationMessage isSuccess={isSuccess} message={message} orderError={orderError} />
                
                 {/* Order Summary (Conditionally Rendered) */} 
                 <OrderSummaryDisplay orderDetails={fetchedOrderDetails} />
                 
                {/* Action Buttons */}
                <ActionButtons isSuccess={isSuccess} confirmationType={confirmationType} />
            </div>
        );
    };

    // --- Main Component Return --- 
    return (
        <div className='grow container mx-auto px-4 py-8 md:py-12'>
            {/* Add a more engaging title? Maybe an icon? */}
            <div className="flex justify-center items-center mb-8">
                 <span className="material-symbols-outlined text-4xl md:text-5xl text-purple-600 mr-3">icecream</span>
                 <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                    Order Status
                 </h1>
            </div>
            {/* Apply slightly different background/padding */}
            <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-100 p-6 md:p-10 rounded-xl shadow-lg border border-slate-200">
                {renderContent()}
            </div>
        </div>
    );
}; 