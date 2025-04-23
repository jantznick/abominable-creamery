import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Reuse the stripePromise from Checkout or re-initialize (ensure consistency)
// It might be better to pass the stripe instance via context or props if needed elsewhere,
// but for simplicity, we re-initialize here if needed.
const stripePromise = process.env.STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.STRIPE_PUBLISHABLE_KEY)
    : Promise.resolve(null);

export const OrderConfirmation = () => {
    const [searchParams] = useSearchParams();
    const { clearCart } = useCart();
    const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

    useEffect(() => {
        stripePromise.then(instance => {
            setStripeInstance(instance);
        });
    }, []);

    useEffect(() => {
        if (!stripeInstance) {
            // Stripe.js hasn't loaded yet. Make sure to disable
            // form submission until Stripe.js has loaded.
             setMessage("Initializing...");
            return;
        }

        const clientSecret = searchParams.get('payment_intent_client_secret');
        const redirectStatus = searchParams.get('redirect_status');

        if (!clientSecret) {
            setMessage("Error: Missing payment information. Please contact support.");
            setIsLoading(false);
            setIsSuccess(false);
            return;
        }

        setIsLoading(true);
        setMessage(null); // Clear previous messages

        stripeInstance
            .retrievePaymentIntent(clientSecret)
            .then(({ paymentIntent }) => {
                switch (paymentIntent?.status) {
                    case 'succeeded':
                        setMessage('Payment successful! Your order is confirmed.');
                        setIsSuccess(true);
                        console.log("Payment succeeded, clearing cart.");
                        clearCart(); // Clear the cart on success
                        break;
                    case 'processing':
                        setMessage("Your payment is processing. We'll update you when payment is received.");
                        setIsSuccess(null); // indeterminate state
                        break;
                    case 'requires_payment_method':
                        setMessage('Payment failed. Please try another payment method.');
                        setIsSuccess(false);
                        break;
                    default:
                        setMessage('Something went wrong processing your payment.');
                        setIsSuccess(false);
                        break;
                }
                setIsLoading(false);
            })
            .catch(error => {
                console.error("Error retrieving payment intent:", error);
                setMessage("Failed to retrieve payment status. Please contact support.");
                setIsLoading(false);
                setIsSuccess(false);
            });
    }, [stripeInstance, searchParams, clearCart]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-16">
                    <div className="spinner border-t-4 border-indigo-500 border-solid rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
                    <p className="text-xl text-slate-600">Loading payment status...</p>
                </div>
            );
        }

        return (
            <div className="text-center py-16">
                {isSuccess === true && (
                    <span className="material-symbols-outlined text-7xl text-green-500 mb-4">check_circle</span>
                )}
                 {isSuccess === false && (
                    <span className="material-symbols-outlined text-7xl text-red-500 mb-4">error</span>
                )}
                 {isSuccess === null && (
                    <span className="material-symbols-outlined text-7xl text-amber-500 mb-4">hourglass_top</span>
                )}

                <p className={`text-xl md:text-2xl font-semibold mb-8 
                    ${isSuccess === true ? 'text-slate-800' : ''}
                    ${isSuccess === false ? 'text-red-700' : ''}
                    ${isSuccess === null ? 'text-slate-700' : ''}
                `}>
                    {message || 'Checking payment status...'}
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