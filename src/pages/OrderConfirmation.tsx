import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
// Removed Stripe imports as status check is now backend-driven
// import { loadStripe, Stripe } from '@stripe/stripe-js';

// Removed stripePromise initialization

// Interface for the data expected from sessionStorage
// Should match the CheckoutData interface defined in Checkout.tsx
interface CheckoutDataForConfirmation {
    items: { 
        productId: string; 
        productName: string; 
        quantity: number;
        price: number; // Price in dollars
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
}

export const OrderConfirmation = () => {
    const [searchParams] = useSearchParams();
    const { clearCart } = useCart();
    // Removed stripeInstance state
    const [message, setMessage] = useState<string | null>('Checking payment status...');
    const [isLoading, setIsLoading] = useState(true);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    // Removed hasFetched state as useEffect dependencies handle it
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null); // State for order creation errors

    // Get Payment Intent ID from URL
    const paymentIntentId = searchParams.get('payment_intent');
    const redirectStatus = searchParams.get('redirect_status'); // Stripe might include this

    useEffect(() => {
        if (!paymentIntentId) {
            console.error("Order Confirmation: Missing payment_intent in URL.");
            setMessage("Error: Required payment information is missing from the URL. Cannot confirm order status.");
            setIsSuccess(false);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setOrderError(null);
        setMessage('Verifying payment...'); // Initial message while fetching
        console.log(`Order Confirmation: Verifying PaymentIntent ID: ${paymentIntentId}`);

        // --- Retrieve Checkout Data from Session Storage ---
        let checkoutData: CheckoutDataForConfirmation | null = null;
        try {
            const storedData = sessionStorage.getItem('checkoutDataForConfirmation');
            if (storedData) {
                checkoutData = JSON.parse(storedData);
                sessionStorage.removeItem('checkoutDataForConfirmation'); // Clear after retrieving
                console.log("Order Confirmation: Retrieved checkout data from sessionStorage.");
            } else {
                throw new Error("Checkout data not found in session storage.");
            }
        } catch (error) {
            console.error("Order Confirmation: Error retrieving or parsing checkout data:", error);
            setMessage("Error: Could not retrieve necessary order details. Please contact support.");
            setIsSuccess(false);
            setIsLoading(false);
            return; // Stop processing if data is missing
        }
        // --- End Retrieve Checkout Data ---

        // Fetch payment status from our backend endpoint
        fetch(`/api/stripe/payment-intent/${paymentIntentId}`)
            .then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({})); // Try to get error details
                    console.error("API Error fetching payment intent:", res.status, errorData);
                    throw new Error(errorData.error || `Server error: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                console.log("Order Confirmation: Received payment intent data:", data);
                setPaymentStatus(data.status); // Store the verified status

                switch (data.status) {
                    case 'succeeded':
                        setMessage('Payment successful! Processing order...');
                        setIsSuccess(true);
                        console.log("Order Confirmation: Payment succeeded. Attempting to create order...");

                        // --- Call POST /api/orders --- 
                        if (checkoutData) {
                            // Add paymentIntentId to the data being sent
                            const orderPayload = { ...checkoutData, paymentIntentId };

                            fetch('/api/orders', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(orderPayload),
                            })
                            .then(async (orderRes) => {
                                const orderResData = await orderRes.json().catch(() => ({}));
                                if (!orderRes.ok) {
                                    console.error("API Error creating order:", orderRes.status, orderResData);
                                    throw new Error(orderResData.message || `Failed to create order: ${orderRes.status}`);
                                }
                                console.log("Order Confirmation: Order created successfully:", orderResData);
                                setMessage(`Payment successful! Your order #${orderResData.orderId} is confirmed.`);
                                clearCart(); // <-- Clear cart ONLY on successful order creation
                            })
                            .catch(err => {
                                console.error("Order Confirmation: Error during order creation API call:", err);
                                setOrderError(err.message || "Payment succeeded, but failed to save your order. Please contact support.");
                                setIsSuccess(false); // Show overall failure if order saving fails
                            })
                            .finally(() => {
                                setIsLoading(false); // Loading finished after order attempt
                            });
                        } else {
                            // This case should ideally not be reached due to checks above
                            console.error("Order Confirmation: Checkout data missing before order creation call.");
                            setOrderError("Critical error: Order details missing after successful payment. Contact support.");
                            setIsSuccess(false);
                            setIsLoading(false);
                        }
                        // Note: setIsLoading(false) is moved to the finally() block of the inner fetch
                        break;
                    case 'processing':
                        setMessage("Your payment is processing. We'll update you when payment is received.");
                        setIsSuccess(null); // Indicate processing state
                        setIsLoading(false); 
                        break;
                    case 'requires_payment_method':
                        setMessage('Payment failed. Please try another payment method or contact support.');
                        setIsSuccess(false);
                        setIsLoading(false); 
                        break;
                    default:
                        console.warn("Order Confirmation: Unhandled payment status:", data.status);
                        setMessage('Something went wrong processing your payment. Please contact support.');
                        setIsSuccess(false);
                        setIsLoading(false); 
                        break;
                }
            })
            .catch(error => {
                console.error("Order Confirmation: Error fetching payment status:", error);
                setMessage(error.message || "Failed to retrieve payment status. Please contact support.");
                setIsSuccess(false);
                setIsLoading(false); // Ensure loading stops on fetch error
            });

        // Dependency array: only run when paymentIntentId changes (effectively once on mount)
    }, [paymentIntentId]); // <-- Removed clearCart

    // --- Removed previous useEffects related to stripeInstance and clientSecret ---

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-16">
                    <div className="spinner border-t-4 border-indigo-500 border-solid rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
                    <p className="text-xl text-slate-600">Loading payment status...</p>
                </div>
            );
        }

        // Display order creation error prominently if it occurred
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

        return (
            <div className="text-center py-16">
                <span className={`material-symbols-outlined text-7xl mb-4 ${
                    isSuccess === true ? 'text-green-500' : 
                    isSuccess === false ? 'text-red-500' : 
                    'text-amber-500' // For processing state
                }`}>
                    {isSuccess === true ? 'check_circle' : 
                     isSuccess === false ? 'error' : 
                     'hourglass_top'}
                </span>

                <p className={`text-xl md:text-2xl font-semibold mb-8 
                    ${isSuccess === true ? 'text-slate-800' : ''}
                    ${isSuccess === false ? 'text-red-700' : ''}
                    ${isSuccess === null ? 'text-slate-700' : ''}
                `}>
                    {message} 
                </p>
                <div className="flex justify-center space-x-4">
                     <Link
                        to="/flavors"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
                    >
                        Continue Shopping
                    </Link>
                     {isSuccess === false && (
                         <Link
                            to="/checkout"
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
                        >
                            Try Again
                        </Link>
                     )}
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