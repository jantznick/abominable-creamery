import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { StripeElementsOptions } from '@stripe/stripe-js'; 
import { Address, ApiSavedCard } from '../types/data'; 
import { OrderSummary } from '../components/checkout/OrderSummary'; 
import { ContactSection } from '../components/checkout/ContactSection'; 
import { ShippingSection } from '../components/checkout/ShippingSection'; 
import { PaymentSection } from '../components/checkout/PaymentSection';

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

// --- Main Checkout Page Component ---
type CheckoutSection = 'auth_choice' | 'contact' | 'shipping' | 'payment';

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

	// --- Order Notes State ---
	const [notes, setNotes] = useState('');

	// --- Saved Addresses State ---
	const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
	const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
	const [errorLoadingAddresses, setErrorLoadingAddresses] = useState<string | null>(null);
	const [selectedAddressId, setSelectedAddressId] = useState<string>(''); // Use empty string for "Enter New"

	// --- State for "Save Address" checkbox ---
	const [saveNewAddress, setSaveNewAddress] = useState(false);

	// --- Saved Cards State ---
	const [savedCards, setSavedCards] = useState<ApiSavedCard[]>([]);
	const [isLoadingCards, setIsLoadingCards] = useState(false);
	const [errorLoadingCards, setErrorLoadingCards] = useState<string | null>(null);
	const [selectedCardId, setSelectedCardId] = useState<string>(''); // Use PM ID or empty string for "New Card"

	// --- State for "Save Card" checkbox ---
	const [saveNewCardForFuture, setSaveNewCardForFuture] = useState<boolean>(false);

	// --- Shipping Rate State --- 
	const [shippingRate, setShippingRate] = useState<number | null>(null);
	const [isLoadingShippingRate, setIsLoadingShippingRate] = useState(true);
	const [errorLoadingShippingRate, setErrorLoadingShippingRate] = useState<string | null>(null);

	// --- Get shipping rate from API --- 
	useEffect(() => {
		setIsLoadingShippingRate(true);
		setErrorLoadingShippingRate(null);
		fetch('/api/stripe/shipping-rate')
			.then(async (res) => {
				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}));
					throw new Error(errorData.error || `Server error: ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				if (typeof data.amount === 'number') {
					setShippingRate(data.amount);
					console.log("Checkout: Fetched shipping rate:", data.amount);
				} else {
					throw new Error("Invalid shipping rate received from server.");
				}
			})
			.catch((err) => {
				console.error("Checkout: Failed to fetch shipping rate:", err);
				setErrorLoadingShippingRate(err.message || "Could not load shipping cost.");
				setShippingRate(9.99); // Use fallback on error
				console.warn("Using fallback shipping rate $9.99 due to fetch error.")
			})
			.finally(() => {
				setIsLoadingShippingRate(false);
			});
	}, []); // Fetch once on mount

	// Calculate Costs (now depends on fetched shipping rate)
	const subtotal = getCartTotal();
	// Use fetched rate, handle loading state by showing 0 temporarily, use fallback on error (already set in state)
	const currentShippingRate = isLoadingShippingRate ? 0 : (shippingRate ?? 9.99); 
	const shippingCost = items.length > 0 ? currentShippingRate : 0; 
	const total = subtotal + shippingCost; 

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

	// Determine if cart contains subscription items
	const containsSubscription = useMemo(() => items.some(item => item.isSubscription), [items]);

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
				shippingAddress: shippingAddress,
				notes: notes, // Include notes in the payload
				selectedCardId: selectedCardId || undefined, // <-- Pass selected card ID if available
				saveNewCardForFuture: saveNewCardForFuture || undefined // <-- Pass save card flag if available
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
		// Removed dependency comments
	}, [activeSection, isShippingComplete, items, clientSecret, checkoutAttemptId, isLoadingSecret, email, phone, fullName, address1, address2, city, state, postalCode, country, notes, selectedCardId, saveNewCardForFuture]);

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

	// --- Effect to fetch Saved Cards ---
	useEffect(() => {
		if (auth.user && !auth.isLoading) {
			setIsLoadingCards(true);
			setErrorLoadingCards(null);
			fetch('/api/cards') // Fetch saved cards
				.then(async res => {
					if (!res.ok) {
						const errorData = await res.json().catch(() => ({}));
						throw new Error(errorData.message || 'Failed to load saved cards.');
					}
					return res.json();
				})
				.then((data: ApiSavedCard[]) => {
					setSavedCards(data);
					// Pre-select default card if available
					const defaultCard = data.find(card => card.isDefault);
					if (defaultCard) {
						console.log("Default saved card found, pre-selecting.");
						setSelectedCardId(defaultCard.stripePaymentMethodId);
					} else {
						setSelectedCardId(''); // Select "New Card" if no default
					}
				})
				.catch(err => {
					console.error("Checkout: Failed to fetch saved cards:", err);
					setErrorLoadingCards(err.message);
				})
				.finally(() => {
					setIsLoadingCards(false);
				});
		}
	}, [auth.user, auth.isLoading]);

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

	// --- Handler for selecting a saved card ---
	const handleSelectCard = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const selectedId = event.target.value;
		setSelectedCardId(selectedId);
		// Future: May need to clear/reset Stripe Elements if switching from New to Saved
		// For now, we just control rendering based on selectedId
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
				totalAmount: total,
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
		items, isContactComplete, isShippingComplete, total,
		fullName, address1, address2, city, state, postalCode, country,
		email, phone,
		auth.user, selectedAddressId, saveNewAddress // Correctly merge dependencies
	]);

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
							{/* Removed Auth choice content placeholder comment */}
							<h2 className="text-2xl font-semibold text-slate-800 mb-6 text-center">Welcome!</h2>
							<p className="text-slate-600 text-center mb-6">How would you like to proceed?</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<button type="button" onClick={handleGuestCheckout} className="w-full sm:w-auto flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out">Checkout as Guest</button>
								<button type="button" onClick={handleLoginClick} className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out">Login / Sign Up</button>
							</div>
						</div>
					)}

					{/* === CONTACT INFO STEP === */}
					{activeSection !== 'auth_choice' && (
						<ContactSection 
							email={email}
							setEmail={setEmail}
							phone={phone}
							setPhone={setPhone}
							isActive={activeSection === 'contact'}
							isComplete={isContactComplete}
							canCompleteContact={canCompleteContact}
							onContinue={handleContinueToShipping}
							onEdit={() => handleEditSection('contact')}
						/>
					)}

					{/* === SHIPPING INFO STEP === */}
					{activeSection !== 'auth_choice' && (
						<ShippingSection 
							// State Props
							fullName={fullName}
							address1={address1}
							address2={address2}
							city={city}
							state={state}
							postalCode={postalCode}
							country={country}
							selectedAddressId={selectedAddressId}
							saveNewAddress={saveNewAddress}
							savedAddresses={savedAddresses}
							isLoadingAddresses={isLoadingAddresses}
							errorLoadingAddresses={errorLoadingAddresses}
							isActive={activeSection === 'shipping'}
							isComplete={isShippingComplete}
							canCompleteShipping={canCompleteShipping}
							isContactComplete={isContactComplete}
							// Setter Props
							setFullName={setFullName}
							setAddress1={setAddress1}
							setAddress2={setAddress2}
							setCity={setCity}
							setState={setState}
							setPostalCode={setPostalCode}
							setCountry={setCountry}
							setSaveNewAddress={setSaveNewAddress}
							// Handler Props
							handleSelectAddress={handleSelectAddress}
							onContinue={handleContinueToPayment}
							onEdit={() => handleEditSection('shipping')}
						/>
					)}

					{/* === PAYMENT STEP === */}
					{activeSection !== 'auth_choice' && (
						<PaymentSection
							// Section State
							notes={notes}
							setNotes={setNotes}
							isActive={activeSection === 'payment'}
							isShippingComplete={isShippingComplete}
							// Intent State
							clientSecret={clientSecret}
							checkoutAttemptId={checkoutAttemptId}
							isLoadingSecret={isLoadingSecret}
							errorLoadingSecret={errorLoadingSecret}
							// Payment Content Props
							auth={auth}
							savedCards={savedCards}
							isLoadingCards={isLoadingCards}
							errorLoadingCards={errorLoadingCards}
							selectedCardId={selectedCardId}
							handleSelectCard={handleSelectCard}
							containsSubscription={containsSubscription}
							saveNewCardForFuture={saveNewCardForFuture}
							setSaveNewCardForFuture={setSaveNewCardForFuture}
							total={total}
						/>
					)}
				</div>

				{/* Order Summary Column */}
				<div className="lg:col-span-1">
					{/* Use OrderSummary component */}
					<OrderSummary 
						items={items}
						subtotal={subtotal}
						shippingCost={shippingCost}
						total={total}
						isLoadingShippingRate={isLoadingShippingRate}
						errorLoadingShippingRate={errorLoadingShippingRate}
					/>
				</div>

			</div>
		</div>
	);
}; 