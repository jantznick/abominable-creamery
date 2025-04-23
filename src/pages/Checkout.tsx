import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, CartItem } from '../context/CartContext';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import classNames from 'classnames'; // Import classnames for conditional styling

// Load Stripe outside of component rendering to avoid recreating Stripe object on every render
// Make sure STRIPE_PUBLISHABLE_KEY is defined in your .env and exposed via Webpack DefinePlugin
const stripePromise = process.env.STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.STRIPE_PUBLISHABLE_KEY)
    : Promise.resolve(null); // Handle case where key might be missing

// Helper component for form inputs
const FormInput = ({ label, id, ...props }: { label: string; id: string; [key: string]: any }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
            {label}
        </label>
        <input
            id={id}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
            {...props}
        />
    </div>
);

// --- Checkout Form Component (contains Stripe Elements) ---
const StripeCheckoutForm = ({ clientSecret }: { clientSecret: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const { clearCart } = useCart(); // Get clearCart
    const navigate = useNavigate();

    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            console.log("Stripe.js not loaded yet");
            return;
        }

        setIsLoading(true);
        setMessage(null); // Clear previous messages

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${window.location.origin}/order-confirmation`, // You'll need to create this page
            },
        });

        // This point will only be reached if there is an immediate error when
        // confirming the payment. Otherwise, your customer will be redirected to
        // your `return_url`. For some payment methods like iDEAL, your customer will
        // be redirected to an intermediate site first to authorize the payment, then
        // redirected to the `return_url`.
        if (error.type === "card_error" || error.type === "validation_error") {
            setMessage(error.message || "An unexpected error occurred.");
        } else {
            setMessage("An unexpected error occurred.");
        }

        setIsLoading(false);
        // Note: If successful, the user is redirected. We don't clear cart or navigate here directly.
        // Cart clearing and navigation should happen on the confirmation page after checking payment status.
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement id="payment-element" options={{layout: "tabs"}} />
            <button 
                disabled={isLoading || !stripe || !elements} 
                id="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span id="button-text">
                    {isLoading ? <div className="spinner border-t-2 border-white border-solid rounded-full w-5 h-5 animate-spin mx-auto"></div> : "Pay now"}
                </span>
            </button>
            {/* Show any error or success messages */}
            {message && <div id="payment-message" className="mt-2 text-center text-red-600 text-sm">{message}</div>}
        </form>
    )
}

// --- Main Checkout Page Component ---
type CheckoutSection = 'contact' | 'shipping' | 'payment';

// --- Constants ---
const FLAT_SHIPPING_RATE = 9.99; // Example flat shipping rate
const ESTIMATED_TAX_RATE = 0.08; // Example 8% tax rate

export const Checkout = () => {
    const { items, getCartTotal, clearCart } = useCart();
    const navigate = useNavigate();
    
    // Accordion State
    const [activeSection, setActiveSection] = useState<CheckoutSection>('contact');
    const [isContactComplete, setIsContactComplete] = useState(false);
    const [isShippingComplete, setIsShippingComplete] = useState(false);

    // Stripe State
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoadingSecret, setIsLoadingSecret] = useState(false); // Only load when payment section is active
    const [errorLoadingSecret, setErrorLoadingSecret] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [fullName, setFullName] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('United States');

    // Calculate Costs
    const subtotal = getCartTotal();
    const shippingCost = items.length > 0 ? FLAT_SHIPPING_RATE : 0; // Only apply shipping if cart not empty
    const estimatedTax = subtotal * ESTIMATED_TAX_RATE;
    const total = subtotal + shippingCost + estimatedTax;
    const totalInCents = Math.round(total * 100); // Use the final total for Stripe

    // Validation Logic
    const canCompleteContact = useMemo(() => email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
    const canCompleteShipping = useMemo(() => 
        fullName.trim() !== '' && 
        address1.trim() !== '' && 
        city.trim() !== '' && 
        state.trim() !== '' && 
        postalCode.trim() !== '' && 
        country.trim() !== '',
        [fullName, address1, city, state, postalCode, country]
    );

    // Effect to redirect if cart is empty (run only once on mount effectively)
    useEffect(() => {
        if (items.length === 0) {
            console.log("Cart is empty, redirecting to /cart");
            navigate('/cart');
        }
    }, [items, navigate]); // Dependency on items might cause issues if cart updates mid-checkout

    // Effect to fetch Payment Intent client secret (ONLY when payment section is active)
    useEffect(() => {
        if (activeSection === 'payment' && !clientSecret && isShippingComplete && items.length > 0 && totalInCents > 0) {
            setIsLoadingSecret(true);
            setErrorLoadingSecret(null);
            console.log("Fetching Payment Intent for amount:", totalInCents);
            fetch('/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: totalInCents }),
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(err => Promise.reject(err));
                }
                return res.json();
            })
            .then(data => {
                if (data.clientSecret) {
                    console.log("Client Secret received");
                    setClientSecret(data.clientSecret);
                } else {
                    throw new Error("Client secret not received");
                }
            })
            .catch(error => {
                console.error("Failed to fetch payment intent:", error);
                setErrorLoadingSecret(error?.error || 'Failed to initialize payment. Please try again.');
            })
            .finally(() => {
                setIsLoadingSecret(false);
            });
        } else if (activeSection === 'payment' && totalInCents <= 0) {
             setErrorLoadingSecret('Cannot process order with zero total.');
             setIsLoadingSecret(false);
        } else if (activeSection !== 'payment') {
            // Reset payment state if navigating away from payment section
             setClientSecret(null);
             setIsLoadingSecret(false);
             setErrorLoadingSecret(null);
        }
    }, [activeSection, isShippingComplete, items, totalInCents, clientSecret]); // Rerun if section/completion/cart changes

    // Stripe Elements options
    const appearance = { theme: 'stripe' as const };
    const options: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance } : undefined;

    // Button Handlers
    const handleContinueToShipping = () => {
        if (canCompleteContact) {
            setIsContactComplete(true);
            setActiveSection('shipping');
        }
    };

    const handleContinueToPayment = () => {
        if (canCompleteShipping) {
            setIsShippingComplete(true);
            setActiveSection('payment');
        }
    };

    const handleEditSection = (section: CheckoutSection) => {
        // Allow editing only if the path is valid (e.g., can't edit payment if shipping isn't complete)
        if (section === 'contact') {
            setActiveSection('contact');
        } else if (section === 'shipping' && isContactComplete) {
            setActiveSection('shipping');
        } else if (section === 'payment' && isShippingComplete) {
             setActiveSection('payment'); // Re-activate payment if needed
        }
    };

    // Helper to render Section Header
    const renderSectionHeader = (section: CheckoutSection, title: string, isComplete: boolean) => (
        <div className="flex justify-between items-center pb-3 mb-6 border-b border-slate-200">
            <h2 className={classNames(
                    "text-2xl font-semibold", 
                    activeSection === section ? 'text-slate-800' : 'text-slate-500'
                )}
            >
                {title}
            </h2>
            {isComplete && activeSection !== section && (
                <button 
                    type="button" 
                    onClick={() => handleEditSection(section)}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    Edit
                </button>
            )}
        </div>
    );

    return (
        <div className='grow container mx-auto px-4 py-8 md:py-16'>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">

                {/* Left Column: Form Sections */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Contact Info Section */}
                    <div className={classNames("bg-white p-6 rounded-lg shadow-md border", activeSection === 'contact' ? 'border-indigo-300' : 'border-slate-200')}>
                        {renderSectionHeader('contact', '1. Contact Information', isContactComplete)}
                        {activeSection === 'contact' && (
                            <div className="space-y-6">
                                <FormInput label="Email Address" id="email" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
                                <FormInput label="Phone Number (Optional)" id="phone" type="tel" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} />
                                <div className="pt-2 text-right">
                                    <button 
                                        type="button"
                                        onClick={handleContinueToShipping}
                                        disabled={!canCompleteContact}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue to Shipping
                                    </button>
                                </div>
                            </div>
                        )}
                         {isContactComplete && activeSection !== 'contact' && (
                             <p className="text-sm text-slate-600">{email}</p> // Show summary when collapsed
                         )}
                    </div>

                    {/* Shipping Address Section */}
                    <div className={classNames("bg-white p-6 rounded-lg shadow-md border", activeSection === 'shipping' ? 'border-indigo-300' : 'border-slate-200', !isContactComplete ? 'opacity-50 pointer-events-none' : '')}>
                         {renderSectionHeader('shipping', '2. Shipping Address', isShippingComplete)}
                         {activeSection === 'shipping' && isContactComplete && (
                            <div className="space-y-6">
                                <FormInput label="Full Name" id="fullName" type="text" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
                                <FormInput label="Address Line 1" id="address1" type="text" value={address1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)} required />
                                <FormInput label="Address Line 2 (Optional)" id="address2" type="text" value={address2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)} />
                                <FormInput label="City" id="city" type="text" value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} required />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormInput label="State / Province" id="state" type="text" value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} required />
                                    <FormInput label="Postal Code" id="postalCode" type="text" value={postalCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)} required />
                                    <FormInput label="Country" id="country" type="text" value={country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} required /> 
                                </div>
                                <div className="pt-2 text-right">
                                     <button 
                                        type="button"
                                        onClick={handleContinueToPayment}
                                        disabled={!canCompleteShipping}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue to Payment
                                    </button>
                                </div>
                            </div>
                         )}
                          {isShippingComplete && activeSection !== 'shipping' && (
                             <p className="text-sm text-slate-600">
                                {fullName}<br/>
                                {address1}, {address2 && `${address2}, `}<br/>
                                {city}, {state} {postalCode}<br/>
                                {country}
                            </p> // Show summary when collapsed
                         )}
                    </div>

                    {/* Payment Section */}
                    <div className={classNames("bg-white p-6 rounded-lg shadow-md border", activeSection === 'payment' ? 'border-indigo-300' : 'border-slate-200', !isShippingComplete ? 'opacity-50 pointer-events-none' : '')}>
                         {renderSectionHeader('payment', '3. Payment Details', false)} {/* Payment never shows 'Edit' in this setup */}
                         {activeSection === 'payment' && isShippingComplete && (
                            <> {/* Fragment to group conditional rendering */} 
                                {isLoadingSecret && ( <div className="text-center p-4 text-slate-600">Loading payment options...</div> )}\
                                {errorLoadingSecret && ( <div className="text-center p-4 text-red-600 bg-red-50 rounded-md">Error: {errorLoadingSecret}</div> )}\
                                {stripePromise && clientSecret && options && (
                                    <Elements options={options} stripe={stripePromise}>
                                        <StripeCheckoutForm clientSecret={clientSecret} />
                                    </Elements>
                                )}\
                                {!stripePromise && !clientSecret && !isLoadingSecret && !errorLoadingSecret && ( 
                                    <div className="text-center p-4 text-slate-500">Initializing payment...</div> 
                                )}\
                                {stripePromise === null && !errorLoadingSecret && ( 
                                     <div className="text-center p-4 text-red-600 bg-red-50 rounded-md">Error: Stripe configuration is missing (Publishable Key).</div>
                                )}\
                             </>
                         )}
                    </div>
                </div>

                {/* Order Summary (Right Column) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md sticky top-24 border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4 border-b border-slate-200 pb-3">Order Summary</h2>
                    <div className="space-y-3 mb-6">
                        {items.map((item: CartItem) => (
                            <div key={item.id} className="flex justify-between items-center text-sm text-slate-600">
                                <span>{item.name} x {item.quantity}</span>
                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2 text-base text-slate-700 border-t border-slate-200 pt-4">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Shipping</span>
                            <span>${shippingCost.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span>Estimated Tax</span>
                            <span>${estimatedTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xl pt-3 border-t border-slate-300 mt-3">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="text-center mt-4">
                        <Link to="/cart" className="text-sm text-indigo-600 hover:underline">
                            &larr; Return to Cart
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}; 