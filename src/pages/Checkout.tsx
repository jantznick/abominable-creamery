import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, CartItem } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import classNames from 'classnames'; // Import classnames for conditional styling
import { Address } from '../types/data'; // Import shared Address type

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
const StripeCheckoutForm = ({ clientSecret, checkoutAttemptId }: { clientSecret: string; checkoutAttemptId: string }) => {
    const stripe = useStripe();
    const elements = useElements();

    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements || !clientSecret || !checkoutAttemptId) {
            console.error("Stripe.js not loaded, missing client secret, OR missing checkoutAttemptId.");
            setMessage("Payment system not ready. Please wait or refresh.");
            return;
        }

        // --- Save ONLY checkoutAttemptId before confirming payment --- 
        try {
            sessionStorage.setItem('checkoutDataForConfirmation', checkoutAttemptId); // Store only the ID
            console.log("Saved checkoutAttemptId to sessionStorage.");
        } catch (error) {
            console.error("Error saving checkoutAttemptId to sessionStorage:", error);
            setMessage("Error preparing session data. Please try again.");
            return; 
        }

        setIsLoading(true);
        setMessage(null); 

        let error: { message?: string, type?: string } | null = null;

        // --- Conditionally Confirm Setup or Payment --- 
        if (clientSecret.startsWith('seti_')) {
            console.log("Confirming SetupIntent...");
            const { error: setupError } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-confirmation`,
                },
            });
            error = setupError || null;

        } else if (clientSecret.startsWith('pi_')) {
            console.log("Confirming PaymentIntent...");
            const { error: paymentError } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-confirmation`,
                },
            });
            error = paymentError || null;
        } else {
            console.error("Invalid client secret format:", clientSecret);
            setMessage("Invalid payment session. Please try again.");
            setIsLoading(false);
            return;
        }
        // -------------------------------------------

        // Handle result
        if (error) {
            if (error.type === "card_error" || error.type === "validation_error") {
                setMessage(error.message || "An unexpected payment error occurred.");
            } else {
                setMessage("An unexpected payment error occurred.");
            }
        } else {
            console.log("Payment/Setup confirmed client-side (likely redirecting)...");
        }

        setIsLoading(false);
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
    const [checkoutAttemptId, setCheckoutAttemptId] = useState<string | null>(null);
    const [isLoadingSecret, setIsLoadingSecret] = useState(false);
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

    // --- Saved Addresses State ---
    const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
    const [errorLoadingAddresses, setErrorLoadingAddresses] = useState<string | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>(''); // Use empty string for "Enter New"

    // --- State for "Save Address" checkbox ---
    const [saveNewAddress, setSaveNewAddress] = useState(false);

    // Calculate Costs
    const subtotal = getCartTotal();
    const shippingCost = items.length > 0 ? FLAT_SHIPPING_RATE : 0; // Only apply shipping if cart not empty
    const estimatedTax = subtotal * ESTIMATED_TAX_RATE;
    const total = subtotal + shippingCost + estimatedTax;
    const totalInCents = Math.round(total * 100); // Use the final total for Stripe
    const totalInDollars = total; // Use the calculated total for checkoutData

    // Validation Logic
    const canCompleteContact = useMemo(() => email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.trim() !== '', [email, phone]);
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

    // Effect to potentially skip auth choice and PREFILL CONTACT/SHIPPING info if already logged in
    useEffect(() => {
        if (activeSection === 'auth_choice' && auth.user && !auth.isLoading) {
            console.log("User logged in. Prefilling fields and advancing to shipping.");
            
            // Prefill contact info
            setEmail(auth.user.email || '');
            setPhone(auth.user.phone || ''); 
            // Pre-validate contact section since email/phone are likely filled
            const prefilledEmail = auth.user.email || '';
            const prefilledPhone = auth.user.phone || '';
            const canPreCompleteContact = prefilledEmail.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefilledEmail);
             // Note: Removed phone check from pre-completion logic as it might not be required, 
             // but kept it for the actual continue button validation `canCompleteContact`.
             // Adjust this if phone is strictly required even when pre-filled.

            if (canPreCompleteContact) {
                 setIsContactComplete(true);
                 console.log("Contact section pre-marked as complete.");
            } else {
                 setIsContactComplete(false); // Ensure it's false if email somehow isn't valid
            }

            // Optionally prefill name for shipping
            setFullName(auth.user.name || ''); 
            
            // Advance directly to shipping section
            setActiveSection('shipping'); 
        }
    }, [auth.user, auth.isLoading, activeSection]); // Dependencies: auth state and current section

    // Effect to fetch Payment/Setup Intent client secret AND checkoutAttemptId
    useEffect(() => {
        if (
            activeSection === 'payment' && 
            !clientSecret && // Only fetch if we don't have one
            !checkoutAttemptId && // AND we don't have an ID
            isShippingComplete && 
            items.length > 0 &&
            !isLoadingSecret // Avoid fetching if already loading
        ) {
            setIsLoadingSecret(true);
            setErrorLoadingSecret(null);

            const contactInfo = { email, phone };
            const shippingAddress = { fullName, address1, address2, city, state, postalCode, country };
            // Prepare payload - ensure items match CartItem structure if needed by backend validation
            const payload = {
                items: items.map(item => ({ // Ensure structure matches CartItem expectation if API depends on it
                    priceId: item.priceId,
                    productId: item.productId,
                    name: item.name,
                    price: item.price, // Sending price string
                    quantity: item.quantity,
                    imageSrc: item.imageSrc,
                    isSubscription: item.isSubscription,
                    recurringInterval: item.recurringInterval,
                    // Explicitly adding slug if CartItem has it and API might use it (though likely not for intent creation)
                    slug: item.slug 
                })),
                contactInfo: contactInfo,
                shippingAddress: shippingAddress
            };
            // ---------------------------------------------
            console.log("Checkout: Sending payload to /api/stripe/initiate-checkout:", JSON.stringify(payload, null, 2));
            // -----------------------------------------

            fetch('/api/stripe/initiate-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(async (res) => {
                if (!res.ok) {
                    const { error } = await res.json().catch(() => ({ error: 'Failed to parse error response.' }));
                    throw new Error(error || `Server error: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (!data.clientSecret || !data.checkoutAttemptId) { // <-- CHECK for both fields
                    throw new Error('Client secret OR checkoutAttemptId not received from server.');
                }
                setClientSecret(data.clientSecret);
                setCheckoutAttemptId(data.checkoutAttemptId); // <-- STORE the ID
                console.log("Received clientSecret and checkoutAttemptId.");
            })
            .catch((error) => {
                console.error("Failed to create payment/setup intent:", error);
                setErrorLoadingSecret(error.message || "Failed to initialize payment.");
                // Reset state if fetch fails
                setClientSecret(null);
                setCheckoutAttemptId(null);
            })
            .finally(() => {
                setIsLoadingSecret(false);
            });
        }
    // --- Dependencies --- 
    // Add checkoutAttemptId to dependency array and include all form fields used in payload
    }, [activeSection, isShippingComplete, items, clientSecret, checkoutAttemptId, isLoadingSecret, email, phone, fullName, address1, address2, city, state, postalCode, country]);

    // --- Effect to fetch Saved Addresses ---
    useEffect(() => {
        // Only run if user is logged in and auth state is settled
        if (auth.user && !auth.isLoading) {
            setIsLoadingAddresses(true);
            setErrorLoadingAddresses(null);
            fetch('/api/addresses')
                .then(async res => {
                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw new Error(errorData.message || 'Failed to load saved addresses.');
                    }
                    return res.json();
                })
                .then((data: Address[]) => {
                    setSavedAddresses(data);
                    // Check if there's a default shipping address
                    const defaultShipping = data.find(addr => addr.type === 'SHIPPING' && addr.isDefault);
                    
                    if (defaultShipping) {
                        console.log("Default shipping address found, pre-filling form.");
                        // Pre-select default and pre-fill form
                        setSelectedAddressId(String(defaultShipping.id));
                        // Keep existing fullName state (pre-filled from auth.user.name earlier)
                        setAddress1(defaultShipping.streetAddress);
                        setAddress2(''); // Assuming Address model doesn't have address2 yet
                        setCity(defaultShipping.city);
                        setState(defaultShipping.state);
                        setPostalCode(defaultShipping.postalCode);
                        setCountry(defaultShipping.country);

                        // Check if the contact step is also complete (likely from login prefill)
                        // If both contact and shipping are effectively complete due to prefill,
                        // mark shipping complete and advance to payment.
                        if (isContactComplete) {
                            console.log("Contact was already complete, marking shipping complete and advancing to payment.")
                            setIsShippingComplete(true);
                            setActiveSection('payment');
                        }
                    } else {
                         console.log("No default shipping address found.");
                         // Ensure we don't advance if no default is used
                         // setIsShippingComplete(false); // No need, default is false
                    }
                })
                .catch(err => {
                    console.error("Checkout: Failed to fetch saved addresses:", err);
                    setErrorLoadingAddresses(err.message);
                })
                .finally(() => {
                    setIsLoadingAddresses(false);
                });
        }
    }, [auth.user, auth.isLoading, isContactComplete]); // Add isContactComplete dependency

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

    // --- Handler for selecting a saved address ---
    const handleSelectAddress = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = event.target.value;
        setSelectedAddressId(selectedId);
        setSaveNewAddress(false); // Reset checkbox when selecting any address (new or saved)

        if (selectedId === '') {
            // "Enter New Address" selected - clear form
            // Keep fullName pre-filled from auth
            setAddress1('');
            setAddress2('');
            setCity('');
            setState('');
            setPostalCode('');
            setCountry('United States'); // Reset to default country
        } else {
            // Find the selected address and pre-fill form
            const selectedAddr = savedAddresses.find(addr => String(addr.id) === selectedId);
            if (selectedAddr) {
                // Keep existing fullName
                setAddress1(selectedAddr.streetAddress);
                setAddress2(''); // Assuming no address2 in model
                setCity(selectedAddr.city);
                setState(selectedAddr.state);
                setPostalCode(selectedAddr.postalCode);
                setCountry(selectedAddr.country);
            }
        }
    };

    // Prepare checkout data for sessionStorage (Add shouldSaveAddress flag)
    const preparedCheckoutData: (CheckoutData & { shouldSaveAddress?: boolean }) | null = useMemo(() => {
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

            const dataToSave: CheckoutData & { shouldSaveAddress?: boolean } = {
                items: mappedItems,
                totalAmount: totalInDollars, 
                shippingAddress: {
                    fullName,
                    address1,
                    address2: address2 || undefined, // Ensure optional fields are undefined if empty
                    city,
                    state,
                    postalCode,
                    country,
                },
                contactInfo: {
                    email,
                    phone: phone, // Ensure optional fields are undefined if empty
                }
            };

            // Add the flag only if user is logged in, entering a new address, and checked the box
            if (auth.user && selectedAddressId === '' && saveNewAddress) {
                dataToSave.shouldSaveAddress = true;
            }

            return dataToSave;

        } catch (error) {
            console.error("Error preparing checkout data:", error);
            return null; 
        }
    }, [
        items, isContactComplete, isShippingComplete, totalInDollars, 
        fullName, address1, address2, city, state, postalCode, country, 
        email, phone, 
        auth.user, selectedAddressId, saveNewAddress // Correctly merge dependencies
    ]);

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

    const renderSectionContent = (section: CheckoutSection) => {
        switch (section) {
            case 'auth_choice':
                return (
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
                );
            case 'contact':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        {renderSectionHeader('contact', '1. Contact Information', isContactComplete)}
                        {activeSection === 'contact' && (
                            <div className="space-y-4">
                                <FormInput label="Email Address" id="email" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required placeholder="you@example.com" />
                                <FormInput label="Phone Number" id="phone" type="tel" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} required placeholder="(555) 123-4567" />
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
                );
            case 'shipping':
                return (
                    <div className={classNames(
                            "bg-white p-6 rounded-lg shadow-md",
                            { 'opacity-50 pointer-events-none': !isContactComplete }
                        )}
                    >
                        {renderSectionHeader('shipping', '2. Shipping Address', isShippingComplete)}
                        {activeSection === 'shipping' && isContactComplete && (
                            <div className="space-y-4">
                                {auth.user && savedAddresses.length > 0 && (
                                    <div className="mb-6 pb-4 border-b border-slate-200">
                                        <label htmlFor="savedAddress" className="block text-sm font-medium text-slate-700 mb-1">Use a Saved Address</label>
                                        <select
                                            id="savedAddress"
                                            name="savedAddress"
                                            value={selectedAddressId}
                                            onChange={handleSelectAddress}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                                        >
                                            <option value="">-- Enter New Address Below --</option>
                                            {savedAddresses
                                                .filter(addr => addr.type === 'SHIPPING') // Only show SHIPPING addresses
                                                .map(addr => (
                                                    <option key={addr.id} value={addr.id}>
                                                        {addr.streetAddress}, {addr.city} {addr.isDefault ? '(Default)' : ''}
                                                    </option>
                                            ))}
                                        </select>
                                        {isLoadingAddresses && <p className="text-sm text-slate-500 mt-1">Loading addresses...</p>}
                                        {errorLoadingAddresses && <p className="text-sm text-red-500 mt-1">Error: {errorLoadingAddresses}</p>}
                                    </div>
                                )}
                                {/* Always show manual input fields */} 
                                <FormInput label="Full Name" id="fullName" type="text" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
                                <FormInput label="Street Address" id="address1" type="text" value={address1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)} required />
                                <FormInput label="Apartment, suite, etc. (Optional)" id="address2" type="text" value={address2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)} />
                                <FormInput label="City" id="city" type="text" value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} required />
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    {/* Consider a select for country/state later */}
                                    <FormInput label="Country" id="country" type="text" value={country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} required />
                                    <FormInput label="State / Province" id="state" type="text" value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} required />
                                    <FormInput label="Postal Code" id="postalCode" type="text" value={postalCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)} required />
                                </div>
                                {/* Save Address Checkbox */}
                                {auth.user && selectedAddressId === '' && (
                                    <div className="flex items-center mt-4 pt-4 border-t border-slate-200">
                                        <input id="saveNewAddress" name="saveNewAddress" type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                        <label htmlFor="saveNewAddress" className="ml-2 block text-sm text-gray-900">Save this address to my profile</label>
                                    </div>
                                )}
                                <button onClick={handleContinueToPayment} disabled={!canCompleteShipping} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
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
                );
            case 'payment':
                return (
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
                                {clientSecret && checkoutAttemptId && stripePromise && options && (
                                    <Elements options={options} stripe={stripePromise}>
                                        <StripeCheckoutForm 
                                            clientSecret={clientSecret} 
                                            checkoutAttemptId={checkoutAttemptId}
                                        />
                                    </Elements>
                                )}
                                {!clientSecret && !checkoutAttemptId && !isLoadingSecret && !errorLoadingSecret && (
                                    <p className="text-center text-red-600">Failed to initialize payment session. Please refresh or contact support.</p>
                                )}
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className='grow container mx-auto px-4 py-8 md:py-16'>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">

                {/* Main Checkout Flow Column */}
                <div className="lg:col-span-2 space-y-8">

                    {/* === AUTH CHOICE STEP === */}
                    {/* Only show this block if user is not logged in AND it's the initial step */} 
                    {!auth.user && activeSection === 'auth_choice' && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                           {/* ... Auth choice content ... */} 
                           <h2 className="text-2xl font-semibold text-slate-800 mb-6 text-center">Welcome!</h2>
                           <p className="text-slate-600 text-center mb-6">How would you like to proceed?</p>
                           <div className="flex flex-col sm:flex-row gap-4 justify-center">
                               <button type="button" onClick={handleGuestCheckout} className="w-full sm:w-auto flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out">Checkout as Guest</button>
                               <button type="button" onClick={handleLoginClick} className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out">Login / Sign Up</button>
                           </div>
                        </div>
                    )}

                    {/* === CONTACT INFO STEP === */}
                    {/* Show contact section once past auth choice */}
                    {activeSection !== 'auth_choice' && (
                         <div className="bg-white p-6 rounded-lg shadow-md">
                            {renderSectionHeader('contact', '1. Contact Information', isContactComplete)}
                            {/* Show form if section is active, otherwise show read-only view IF complete */} 
                            {activeSection === 'contact' ? (
                                <div className="space-y-4">
                                    {/* ... Contact form inputs and button ... */} 
                                    <FormInput label="Email Address" id="email" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required placeholder="you@example.com" />
                                    <FormInput label="Phone Number" id="phone" type="tel" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} required placeholder="(555) 123-4567" />
                                    <button type="button" onClick={handleContinueToShipping} disabled={!canCompleteContact} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">Continue to Shipping</button>
                                </div>
                            ) : isContactComplete ? (
                                <div className="text-slate-600 text-sm">
                                    <p>Email: {email}</p>
                                    {phone && <p>Phone: {phone}</p>}
                                </div>
                            ) : null} {/* Don't show anything if not active and not complete */} 
                        </div>
                    )}
                   
                    {/* === SHIPPING INFO STEP === */}
                    {/* Show shipping section once past auth choice */} 
                    {activeSection !== 'auth_choice' && (
                         <div className={classNames(
                                "bg-white p-6 rounded-lg shadow-md",
                                { 'opacity-50 pointer-events-none': !isContactComplete } // Disable based on previous step completion
                            )}
                        >
                            {renderSectionHeader('shipping', '2. Shipping Address', isShippingComplete)}
                            {/* Show form if section is active AND previous is complete, otherwise show read-only view IF this section complete */} 
                            {activeSection === 'shipping' && isContactComplete ? (
                                <div className="space-y-4">
                                    {/* Saved Address Dropdown */}
                                    {auth.user && savedAddresses.length > 0 && (
                                        <div className="mb-6 pb-4 border-b border-slate-200">
                                            {/* ... Dropdown JSX ... */} 
                                            <label htmlFor="savedAddress" className="block text-sm font-medium text-slate-700 mb-1">Use a Saved Address</label>
                                            <select id="savedAddress" name="savedAddress" value={selectedAddressId} onChange={handleSelectAddress} className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
                                                <option value="">-- Enter New Address Below --</option>
                                                {savedAddresses.filter(addr => addr.type === 'SHIPPING').map(addr => (
                                                    <option key={addr.id} value={addr.id}> {addr.streetAddress}, {addr.city} {addr.isDefault ? '(Default)' : ''}</option>
                                                ))}
                                            </select>
                                            {isLoadingAddresses && <p className="text-sm text-slate-500 mt-1">Loading addresses...</p>}
                                            {errorLoadingAddresses && <p className="text-sm text-red-500 mt-1">Error: {errorLoadingAddresses}</p>}
                                        </div>
                                    )}
                                    {/* Manual input fields */} 
                                    {/* ... Address FormInputs ... */} 
                                    <FormInput label="Full Name" id="fullName" type="text" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
                                    <FormInput label="Street Address" id="address1" type="text" value={address1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)} required />
                                    <FormInput label="Apartment, suite, etc. (Optional)" id="address2" type="text" value={address2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)} />
                                    <FormInput label="City" id="city" type="text" value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} required />
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                        <FormInput label="Country" id="country" type="text" value={country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} required />
                                        <FormInput label="State / Province" id="state" type="text" value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} required />
                                        <FormInput label="Postal Code" id="postalCode" type="text" value={postalCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)} required />
                                    </div>
                                    {/* Save Address Checkbox */} 
                                    {auth.user && selectedAddressId === '' && (
                                        <div className="flex items-center mt-4 pt-4 border-t border-slate-200">
                                            {/* ... Checkbox JSX ... */} 
                                            <input id="saveNewAddress" name="saveNewAddress" type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                            <label htmlFor="saveNewAddress" className="ml-2 block text-sm text-gray-900">Save this address to my profile</label>
                                        </div>
                                    )}
                                    {/* Continue button */} 
                                    <button type="button" onClick={handleContinueToPayment} disabled={!canCompleteShipping} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                                        Continue to Payment
                                    </button>
                                </div>
                            ) : isShippingComplete ? (
                                <div className="text-slate-600 text-sm">
                                    {/* ... Read-only shipping details ... */} 
                                    <p>{fullName}</p>
                                    <p>{address1}{address2 ? `, ${address2}` : ''}</p>
                                    <p>{city}, {state} {postalCode}</p>
                                    <p>{country}</p>
                                </div>
                            ) : null} {/* Don't show form/details if prerequisites not met */}
                        </div>
                    )}

                    {/* === PAYMENT STEP === */}
                     {/* Show payment section once past auth choice */}
                    {activeSection !== 'auth_choice' && (
                        <div className={classNames(
                                "bg-white p-6 rounded-lg shadow-md",
                                { 'opacity-50 pointer-events-none': !isShippingComplete } // Disable based on previous step completion
                            )}
                        >
                             {renderSectionHeader('payment', '3. Payment', false)} {/* Payment never shows as 'complete' */} 
                             {/* Show Stripe form IF this section is active AND previous is complete */} 
                            {activeSection === 'payment' && isShippingComplete ? (
                                <div>
                                    {/* ... Loading/Error logic ... */} 
                                    {isLoadingSecret && <p className="text-center text-slate-500"><div className="spinner border-t-2 border-indigo-500 border-solid rounded-full w-5 h-5 animate-spin mx-auto mb-2"></div>Initializing payment...</p>}
                                    {errorLoadingSecret && <p className="text-center text-red-600">{errorLoadingSecret}</p>}
                                    {clientSecret && checkoutAttemptId && stripePromise && options && (
                                        <Elements options={options} stripe={stripePromise}>
                                            <StripeCheckoutForm 
                                                clientSecret={clientSecret} 
                                                checkoutAttemptId={checkoutAttemptId}
                                            />
                                        </Elements>
                                    )}
                                    {!clientSecret && !checkoutAttemptId && !isLoadingSecret && !errorLoadingSecret && (
                                        <p className="text-center text-red-600">Failed to initialize payment session. Please refresh or contact support.</p>
                                    )}
                                </div>
                            ) : null} {/* Don't show payment form if prerequisites not met */} 
                        </div>
                    )}
                </div>

                {/* Order Summary Column */}
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