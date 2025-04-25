import React, { useState, useEffect } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { StripePaymentElementOptions } from '@stripe/stripe-js';

interface AddCardFormProps {
    clientSecret: string | null;
    onCloseRequest: () => void; // Request parent to close the modal
    onError: (errorMessage: string) => void; 
}

const AddCardForm: React.FC<AddCardFormProps> = ({ 
    clientSecret, 
    onCloseRequest, 
    onError
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false); 

    // Clear processing state if the component re-renders with no clientSecret (e.g., modal closed externally)
    useEffect(() => {
        if (!clientSecret) {
            setIsProcessing(false);
        }
    }, [clientSecret]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        onError(''); 

        if (!stripe || !elements || !clientSecret) {
            onError('Payment system not ready. Please wait a moment and try again.');
            return;
        }

        setIsProcessing(true);

        const { error, setupIntent } = await stripe.confirmSetup({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/profile`, // Still need a return URL
            },
             redirect: 'if_required', 
        });

        if (error) {
            // Immediate error from Stripe (validation, card error, etc.)
            console.error('Stripe confirmSetup error:', error);
             if (error.type === "card_error" || error.type === "validation_error") {
                 onError(error.message || 'Card validation failed.');
            } else {
                 onError("An unexpected error occurred during card setup.");
            }
             setIsProcessing(false); // Stop processing on immediate error
        } else {
            // Setup initiated without immediate error (might redirect or process async)
            console.log('Stripe confirmSetup initiated successfully (no immediate error).', setupIntent?.status);
            
            // --- Artificial Delay --- 
            // Keep showing processing indicator for a few seconds
            setTimeout(() => {
                 console.log("Delay finished, requesting modal close.");
                 setIsProcessing(false); // Set processing false *before* closing
                 onCloseRequest(); // Request modal close after delay
            }, 1500); // 1.5-second delay
            // Note: isProcessing remains true during this delay
        }
    };

    const paymentElementOptions: StripePaymentElementOptions = {
        layout: "tabs",
    };

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" options={paymentElementOptions} />
            <button 
                disabled={!stripe || !elements || !clientSecret || isProcessing} 
                id="submit"
                className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
                <span>{isProcessing ? 'Processing...' : 'Save Card'}</span>
            </button>
        </form>
    );
};

export default AddCardForm; 