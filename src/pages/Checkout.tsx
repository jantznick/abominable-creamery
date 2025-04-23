import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, CartItem } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
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

// Define expected structure for checkout data to be saved
interface CheckoutData {
    items: {
        // Use productId to match backend OrderItemSchema
        productId: string; 
        productName: string; // This is CartItem.name (which includes pack description)
        quantity: number;
        price: number; // Store as number for order schema
    }[];
    totalAmount: number; // Total in dollars
    shippingAddress: { // Mirroring AddressSchema in orders.ts
        fullName: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    contactInfo: { // Mirroring ContactInfoSchema in orders.ts
        email: string;
        phone?: string;
    };
}

// --- Checkout Form Component (contains Stripe Elements) ---
const StripeCheckoutForm = ({ clientSecret, checkoutData }: { clientSecret: string; checkoutData: CheckoutData }) => {
    const stripe = useStripe();
    const elements = useElements();

    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            console.log("Stripe.js not loaded yet");
            return;
        }

        // --- Save checkout data before confirming payment --- 
        try {
            // Ensure essential data is present before saving
            if (!checkoutData || !checkoutData.items || checkoutData.items.length === 0 || !checkoutData.shippingAddress || !checkoutData.contactInfo) {
                throw new Error("Missing essential checkout data for saving.");
            }
            sessionStorage.setItem('checkoutDataForConfirmation', JSON.stringify(checkoutData));
            console.log("Checkout data saved to sessionStorage.");
        } catch (error) {
            console.error("Error saving checkout data to sessionStorage:", error);
            setMessage("Error preparing order data. Please try again or contact support.");
            // Optionally prevent payment confirmation if saving fails critically
            // return; 
        }
        // --- End save checkout data ---

        setIsLoading(true);
        setMessage(null); // Clear previous messages

        // Proceed with payment confirmation
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/order-confirmation`,
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
type CheckoutSection = 'auth_choice' | 'contact' | 'shipping' | 'payment';

// --- Constants ---
const FLAT_SHIPPING_RATE = 9.99; // Example flat shipping rate
const ESTIMATED_TAX_RATE = 0.08; // Example 8% tax rate

export const Checkout = () => {
    const { items, getCartTotal, clearCart } = useCart();
    const auth = useAuth();
    const navigate = useNavigate();
    
    // Accordion State
    const [activeSection, setActiveSection] = useState<CheckoutSection>('auth_choice');
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
    const totalInDollars = total; // Use the calculated total for checkoutData

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

    // Effect to redirect if cart is empty
    useEffect(() => {
        if (items.length === 0 && activeSection !== 'auth_choice') {
            console.log("Cart is empty, redirecting to /cart");
            navigate('/cart');
        }
    }, [items, navigate, activeSection]);

    // Effect to potentially skip auth choice if already logged in
    useEffect(() => {
        if (activeSection === 'auth_choice' && auth.user && !auth.isLoading) {
            console.log("User already logged in, skipping auth choice.");
            setActiveSection('contact');
        }
    }, [auth.user, auth.isLoading, activeSection]);

    // Effect to fetch Payment Intent client secret
    useEffect(() => {
        // Ensure cart items are available from context
        // This payload is for /create-payment-intent, which needs priceId!
        const cartItemsForPayload = items.map(item => ({
            priceId: item.priceId, // Correct: Use priceId here
            quantity: item.quantity
        }));

        if (
            activeSection === 'payment' && 
            !clientSecret && 
            isShippingComplete && 
            cartItemsForPayload.length > 0
            // No need to check totalInCents > 0 here, backend calculates total
        ) {
            setIsLoadingSecret(true);
            setErrorLoadingSecret(null);
            console.log("Fetching Payment Intent for items:", cartItemsForPayload);
            fetch('/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the items array instead of the calculated amount
                body: JSON.stringify({ items: cartItemsForPayload }), 
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
        } else if (activeSection === 'payment' && cartItemsForPayload.length === 0) {
             setErrorLoadingSecret('Your cart is empty. Cannot initialize payment.');
             setIsLoadingSecret(false);
        } else if (activeSection !== 'payment') {
            // Reset payment state if navigating away from payment section
             setClientSecret(null);
             setIsLoadingSecret(false);
             setErrorLoadingSecret(null);
        }
        // Dependencies: Add items directly if CartContext guarantees stable reference, 
        // otherwise, consider stringifying items or using itemCount for dependency array
    }, [activeSection, isShippingComplete, items, clientSecret]); // Added items

    // Stripe Elements options
    const appearance = { theme: 'stripe' as const };
    const options: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance } : undefined;

    // Button Handlers
    const handleGuestCheckout = () => {
        setActiveSection('contact');
    };

    const handleLoginClick = () => {
        auth.openLogin();
    };

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
        if (section === 'contact') {
            setActiveSection('contact');
        } else if (section === 'shipping' && isContactComplete) {
            setActiveSection('shipping');
        } else if (section === 'payment' && isShippingComplete) {
             setActiveSection('payment');
        }
    };

    // Prepare checkout data for sessionStorage (used by StripeCheckoutForm)
    // This needs to be created *outside* the StripeCheckoutForm component
    // so it's available when StripeCheckoutForm mounts/renders
    const preparedCheckoutData: CheckoutData | null = useMemo(() => {
        // Only prepare if contact and shipping are complete
        if (!isContactComplete || !isShippingComplete) return null;
        
        try {
            const mappedItems = items.map(item => {
                const priceAsNumber = parseFloat(item.price);
                if (isNaN(priceAsNumber)) {
                    console.error(`Invalid price format in cart item: ${item.productId}, ${item.price}`);
                    throw new Error("Invalid item price found in cart."); // Throw to prevent bad data
                }
                return {
                    // Map productId for the backend OrderItem schema
                    productId: item.productId, 
                    productName: item.name, 
                    quantity: item.quantity,
                    price: priceAsNumber // Store as number
                };
            });

            return {
                items: mappedItems,
                totalAmount: totalInDollars, // Use previously calculated total
                shippingAddress: {
                    fullName,
                    address1,
                    address2,
                    city,
                    state,
                    postalCode,
                    country,
                },
                contactInfo: {
                    email,
                    phone,
                }
            };
        } catch (error) {
            console.error("Error preparing checkout data:", error);
            // Maybe set an error state to display to the user?
            return null; // Return null if data preparation fails
        }
    }, [items, isContactComplete, isShippingComplete, totalInDollars, fullName, address1, address2, city, state, postalCode, country, email, phone]);

    const renderSectionHeader = (section: CheckoutSection, title: string, isComplete: boolean) => (
        <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${isComplete && activeSection !== section ? 'text-slate-600' : 'text-slate-800'}`}>{title}</h2>
            {isComplete && activeSection !== section && (
                <button 
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

                {/* Main Checkout Flow Column */}
                <div className="lg:col-span-2 space-y-8">

                    {/* === AUTH CHOICE STEP === */}
                    {activeSection === 'auth_choice' && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-2xl font-semibold text-slate-800 mb-6 text-center">Welcome!</h2>
                            <p className="text-slate-600 text-center mb-6">How would you like to proceed?</p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    type="button"
                                    onClick={handleGuestCheckout}
                                    className="w-full sm:w-auto flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out"
                                >
                                    Checkout as Guest
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLoginClick}
                                    className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out"
                                >
                                    Login / Sign Up
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === CONTACT INFO STEP === */}
                    {activeSection !== 'auth_choice' && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            {renderSectionHeader('contact', '1. Contact Information', isContactComplete)}
                            {activeSection === 'contact' && (
                                <div className="space-y-4">
                                    <FormInput label="Email Address" id="email" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required placeholder="you@example.com" />
                                    <FormInput label="Phone Number (Optional)" id="phone" type="tel" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                                    <button 
                                        type="button"
                                        onClick={handleContinueToShipping}
                                        disabled={!canCompleteContact}
                                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue to Shipping
                                    </button>
                                </div>
                            )}
                            {activeSection !== 'contact' && isContactComplete && (
                                <div className="text-slate-600 text-sm">
                                    <p>Email: {email}</p>
                                    {phone && <p>Phone: {phone}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* === SHIPPING INFO STEP === */}
                    {activeSection !== 'auth_choice' && (
                        <div className={classNames(
                                "bg-white p-6 rounded-lg shadow-md",
                                { 'opacity-50 pointer-events-none': !isContactComplete }
                            )}
                        >
                            {renderSectionHeader('shipping', '2. Shipping Address', isShippingComplete)}
                            {activeSection === 'shipping' && isContactComplete && (
                                <div className="space-y-4">
                                    <FormInput label="Full Name" id="fullName" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
                                    <FormInput label="Address Line 1" id="address1" value={address1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)} required placeholder="123 Main St" />
                                    <FormInput label="Address Line 2 (Optional)" id="address2" value={address2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)} placeholder="Apartment, suite, etc." />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormInput label="City" id="city" value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} required className="md:col-span-1" />
                                        <FormInput label="State / Province" id="state" value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} required className="md:col-span-1" />
                                        <FormInput label="Postal Code" id="postalCode" value={postalCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)} required className="md:col-span-1" />
                                    </div>
                                    <FormInput label="Country" id="country" value={country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} required />
                                    <button 
                                        type="button"
                                        onClick={handleContinueToPayment}
                                        disabled={!canCompleteShipping}
                                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue to Payment
                                    </button>
                                </div>
                            )}
                            {activeSection !== 'shipping' && isShippingComplete && (
                                <div className="text-slate-600 text-sm">
                                    <p>{fullName}</p>
                                    <p>{address1}{address2 ? `, ${address2}` : ''}</p>
                                    <p>{city}, {state} {postalCode}</p>
                                    <p>{country}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === PAYMENT STEP === */}
                    {activeSection !== 'auth_choice' && (
                        <div className={classNames(
                                "bg-white p-6 rounded-lg shadow-md",
                                { 'opacity-50 pointer-events-none': !isShippingComplete }
                            )}
                        >
                            {renderSectionHeader('payment', '3. Payment', false)}
                            {activeSection === 'payment' && isShippingComplete && (
                                <div>
                                    {isLoadingSecret && <p className="text-center text-slate-500"><div className="spinner border-t-2 border-indigo-500 border-solid rounded-full w-5 h-5 animate-spin mx-auto mb-2"></div>Initializing payment...</p>}
                                    {errorLoadingSecret && <p className="text-center text-red-600">{errorLoadingSecret}</p>}
                                    {clientSecret && stripePromise && options && preparedCheckoutData && (
                                        <Elements options={options} stripe={stripePromise}>
                                            <StripeCheckoutForm 
                                                clientSecret={clientSecret} 
                                                checkoutData={preparedCheckoutData}
                                            />
                                        </Elements>
                                    )}
                                    {activeSection === 'payment' && isShippingComplete && !preparedCheckoutData && !isLoadingSecret && !errorLoadingSecret && (
                                        <p className="text-center text-red-600">There was an error preparing your order data. Please review your cart or contact support.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Order Summary Column (always visible) */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-50 p-6 rounded-lg shadow-md sticky top-24">
                        <h2 className="text-xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">Order Summary</h2>
                        
                        {/* Cart Items Mini View */}
                        <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
                            {items.map((item) => {
                                const itemPrice = parseFloat(item.price);
                                const itemTotal = !isNaN(itemPrice) ? (itemPrice * item.quantity).toFixed(2) : 'Invalid';
                                return (
                                    <div key={item.productId} className="flex justify-between items-center text-sm">
                                        <span className="flex-1 mr-2">{item.name} ({item.quantity})</span>
                                        <span className="text-slate-700 font-medium">${itemTotal}</span>
                                    </div>
                                );
                            })}
                            {items.length === 0 && <p className="text-slate-500 text-sm text-center">(Your cart is empty)</p>}
                        </div>

                        {/* Cost Breakdown */}
                        <div className="space-y-2 border-t border-slate-200 pt-4">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Shipping</span>
                                <span>${shippingCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Estimated Tax</span>
                                <span>${estimatedTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-300 pt-3 mt-3">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}; 