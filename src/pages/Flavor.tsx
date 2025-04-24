import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom';
// import { flavors as staticFlavors } from '../utils/content'; // Remove static import
import { useProducts } from '../context/ProductContext'; // Import product context hook
import { Flavor as FlavorType, PriceOption } from '../types/flavor'; // Import correct types
import { useCart, AddItemPayload } from '../context/CartContext'; // Import useCart AND AddItemPayload from context
import { useAuth } from '../context/AuthContext'; // <--- Import useAuth
// import { AddItemPayload } from '../types/cart'; // Remove incorrect import

// Remove local FlavorData type
// interface FlavorData { ... }

// Temporary fallback image logic (same as MiniFlavorCard)
const colors: Record<number, string> = {
	0: 'green',
	1: 'pink',
	2: 'blue'
};

// Type for purchase selection
// type PurchaseType = 'one-time' | 'subscription';

export const Flavor = () => {
	const [quantity, setQuantity] = useState(1);
	const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null); // ID of the selected BASE (non-sub) price option
	const [isSubscribed, setIsSubscribed] = useState<boolean>(false); // Is the *currently selected* option subscribed?
	// const [subscriptionSelections, setSubscriptionSelections] = useState<{ [nonSubPriceId: string]: boolean }>({}); // REMOVED
	// Get slug from URL params instead of flavorId
	const { slug } = useParams<{ slug: string }>();
	const { addItem } = useCart();
	const { flavors } = useProducts(); // Get flavors from context
	const auth = useAuth(); // <--- Get auth object

	// Find the flavor from context data using the slug
	const flavorData: FlavorType | undefined = flavors.find(f => f.slug === slug);

	// Create a map for quick price lookup by ID and filter displayable (non-sub) prices
	const { priceMap, displayablePrices } = useMemo(() => {
		if (!flavorData) return { priceMap: {}, displayablePrices: [] };
		const map: { [priceId: string]: PriceOption } = {};
		const displayable: PriceOption[] = [];
		flavorData.prices.forEach(p => {
			map[p.priceId] = p;
			if (!p.isSubscription) {
				displayable.push(p);
			}
		});
		// Sort displayable prices (e.g., default first)
		displayable.sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			// Secondary sort could go here (e.g., parseFloat(a.price) - parseFloat(b.price))
			return 0;
		});
		return { priceMap: map, displayablePrices: displayable };
	}, [flavorData]);

	// Determine the currently selected effective PriceOption based on selectedPriceId and isSubscribed flag
	const selectedEffectivePrice: PriceOption | null = useMemo(() => {
		if (!selectedPriceId || !priceMap[selectedPriceId]) {
			return null; // No base price selected
		}
		const baseSelectedPrice = priceMap[selectedPriceId];
		
		// Check if the user wants to subscribe to this *selected* base price
		if (isSubscribed && baseSelectedPrice.subscriptionId && priceMap[baseSelectedPrice.subscriptionId]) {
			// Return the corresponding subscription price object
			return priceMap[baseSelectedPrice.subscriptionId];
		}
		
		// Otherwise, return the base (non-subscription) price object
		return baseSelectedPrice;
	}, [selectedPriceId, isSubscribed, priceMap]);

	// Effect to set the default selected radio button when flavor/prices load
	useEffect(() => {
		if (displayablePrices.length > 0) {
			const defaultPrice = displayablePrices.find(p => p.isDefault) || displayablePrices[0];
			setSelectedPriceId(defaultPrice.priceId);
			setIsSubscribed(false); // Default to not subscribed
		} else {
			setSelectedPriceId(null);
			setIsSubscribed(false);
		}
		setQuantity(1);
	}, [displayablePrices]);

	// --- Effect to reset subscription state on logout --- 
	useEffect(() => {
		if (!auth.user && !auth.isLoading) {
			// If user logs out while viewing, uncheck subscription
			setIsSubscribed(false);
		}
	}, [auth.user, auth.isLoading]);
	// -----------------------------------------------------

	// Handler for changing purchase type
	// const handlePurchaseTypeChange = (type: PurchaseType) => { ... };

	// Handle flavor not found or context still loading
	if (!flavorData) {
		// Check if context is loading vs flavor truly not found
		// For simplicity, show "not found" if flavor isn't in the loaded list
		return (
			<div className='grow flex flex-col items-center justify-center text-center p-8 bg-slate-50'>
				<span className="material-symbols-outlined text-6xl text-amber-500 mb-4">error</span>
				<h1 className="text-2xl md:text-4xl font-bold text-slate-700 mb-4">Oops! Flavor Not Found</h1>
				<p className="text-lg text-slate-500 mb-8">We couldn't find the flavor you were looking for in our current selection.</p>
				<Link to="/flavors" className='bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 ease-in-out'>
					Back to Flavors
				</Link>
			</div>
		);
	}

	const handleQuantityChange = (amount: number) => {
		setQuantity(prev => Math.max(1, prev + amount)); 
	};

	// Handler for Radio Button Selection Change
	const handlePriceSelectionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setSelectedPriceId(event.target.value);
		setIsSubscribed(false); // Selecting radio always defaults to one-time
	}, []);

	// Handler for Subscription Checkbox Change
	const handleSubscriptionCheckboxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const { value: nonSubPriceId, checked } = event.target;
		if (checked) {
			// Select the corresponding radio button AND set subscription flag
			setSelectedPriceId(nonSubPriceId);
			setIsSubscribed(true);
		} else {
			// Just uncheck the subscription, keep the same radio selected
			// (Only relevant if the currently selected radio matches the checkbox being unchecked)
			if (selectedPriceId === nonSubPriceId) {
				setIsSubscribed(false);
			}
			// If a different radio is selected, this uncheck doesn't change the state
		}
	}, [selectedPriceId]);

	const handleAddToCart = () => {
		if (!flavorData || !selectedEffectivePrice) return;
		// --- Add check: Prevent adding subscription if not logged in --- 
		if (selectedEffectivePrice.isSubscription && !auth.user) {
			console.error("Attempted to add subscription item while logged out.");
			// Optionally show an error message to the user
			auth.openLogin(); // Prompt login
			return; // Prevent adding to cart
		}
		// -------------------------------------------------------------

		const itemPayload: AddItemPayload = {
			priceId: selectedEffectivePrice.priceId,
			productId: flavorData.id,
			slug: flavorData.slug,
			name: `${flavorData.name} ${selectedEffectivePrice.unitDescription ? `(${selectedEffectivePrice.unitDescription})` : ''}${selectedEffectivePrice.isSubscription ? ' (Subscription)' : ''}`,
			price: selectedEffectivePrice.price,
			imageSrc: flavorData.imageSrc || undefined,
			isSubscription: selectedEffectivePrice.isSubscription,
			recurringInterval: selectedEffectivePrice.recurringInterval,
		};
		addItem(itemPayload, quantity);

		console.log(`Adding ${quantity} of ${itemPayload.name} with price ID ${itemPayload.priceId} to cart. Subscription: ${itemPayload.isSubscription}`);
	};

	// Determine image source
	const randomNum = Math.floor(Math.random() * 3);
	const imageToDisplay = flavorData.imageSrc || `/images/${colors[randomNum]}-soon.png`;

	// Helper function to calculate savings based on original price and sub price
	const getSubscriptionSavings = (originalPriceOpt: PriceOption, subPriceOpt: PriceOption): { originalPrice?: string; savingsPercent?: number } => {
		if (!originalPriceOpt || !subPriceOpt) {
			return {};
		}

		const subPriceNum = parseFloat(subPriceOpt.price);
		const oneTimePriceNum = parseFloat(originalPriceOpt.price);

		if (isNaN(subPriceNum) || isNaN(oneTimePriceNum) || oneTimePriceNum <= subPriceNum) {
			console.warn(`Could not calculate savings. Sub price: ${subPriceOpt.price}, Original price: ${originalPriceOpt.price}`);
			return {};
		}

		const savingsPercent = Math.round(((oneTimePriceNum - subPriceNum) / oneTimePriceNum) * 100);
		return {
			originalPrice: originalPriceOpt.price,
			savingsPercent: savingsPercent,
		};
	};

	return (
		<div className='grow bg-slate-50 px-4 py-8 md:py-16'>
			<div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start bg-white p-6 md:p-10 rounded-lg shadow-md border border-slate-200">

				{/* Image Column */}
				<div className="w-full aspect-square overflow-hidden rounded-lg shadow-lg">
					<img
						src={imageToDisplay}
						alt={flavorData.name}
						className="w-full h-full object-cover"
					/>
				</div>

				{/* Details Column */}
				<div className="flex flex-col space-y-4 md:space-y-5">
					<h1 className="text-3xl md:text-4xl font-bold text-slate-900">{flavorData.name}</h1>
					{flavorData.simpleName && <p className="text-md text-slate-500 -mt-3 mb-2">({flavorData.simpleName})</p>}
					<p className="text-base text-slate-700 leading-relaxed">{flavorData.description || 'No description available.'}</p>

					{/* REMOVED Purchase Type Selection */}
					{/* {oneTimePrices.length > 0 && hasSubscriptionOptions && ( ... )} */}

					{/* Price Options - Render only non-subscription, add checkbox */}
					<div className="space-y-2 pt-3">
						<h3 className="text-lg font-medium text-slate-800">Select Option:</h3>
						{displayablePrices.map((priceOpt) => {
							// Determine if subscription is possible for this option
							const canSubscribe = !!(priceOpt.subscriptionId && priceMap[priceOpt.subscriptionId]);
							// Determine if this specific option IS the one currently subscribed
							const isThisOptionSubscribed = isSubscribed && selectedPriceId === priceOpt.priceId;
							
							const subPriceOpt = canSubscribe ? priceMap[priceOpt.subscriptionId!] : null;

							// Get the price/details to actually display based on subscription state *for this option*
							const effectivePrice = isThisOptionSubscribed && subPriceOpt ? subPriceOpt.price : priceOpt.price;
							const savings = isThisOptionSubscribed && subPriceOpt ? getSubscriptionSavings(priceOpt, subPriceOpt) : null;
							const interval = isThisOptionSubscribed && subPriceOpt ? subPriceOpt.recurringInterval : null;

							return (
								<div key={priceOpt.priceId} className={`p-3 border rounded-md transition-colors duration-150 ${selectedPriceId === priceOpt.priceId ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
									<label className="flex items-center space-x-3 cursor-pointer">
										<input
											type="radio"
											name={`priceOption-${flavorData.id}`}
											value={priceOpt.priceId}
											checked={selectedPriceId === priceOpt.priceId}
											onChange={handlePriceSelectionChange}
											className="form-radio h-5 w-5 text-amber-600 focus:ring-amber-500 border-slate-300 mt-1 self-start flex-shrink-0"
										/>
										<div className="flex-grow flex items-center justify-between">
											<span className="mr-3">
												<span className="block text-md font-medium text-slate-700">
													{priceOpt.displayName || priceOpt.unitDescription || 'Standard'}
												</span>
											</span>
											<div className="flex items-baseline space-x-2 flex-shrink-0">
												<span className="text-xl font-semibold text-amber-600">
													${effectivePrice}
												</span>
												{/* Show interval only if this option is subscribed */} 
												{isThisOptionSubscribed && interval && (
													<span className="text-xs font-normal text-slate-500">/ {interval}</span>
												)}
												{/* Show savings only if this option is subscribed */} 
												{isThisOptionSubscribed && savings?.originalPrice && savings?.savingsPercent && (
													<span className="text-sm text-slate-500 line-through">
														${savings.originalPrice}
													</span>
												)}
											</div>
										</div>
									</label>

									{/* Subscription Checkbox Area (conditional on login) */} 
									{canSubscribe && (
										<div className="mt-3 pt-3 border-t border-slate-200">
											{!auth.user && !auth.isLoading ? (
												// --- Guest View --- 
												<p className="text-sm text-slate-600">
													<button type="button" onClick={() => auth.openLogin()} className="text-indigo-600 hover:underline font-medium">
														Login or Sign Up to Subscribe & Save {savings?.savingsPercent ? ` for ${savings.savingsPercent}% off!` : ''}!
													</button>
													{` to Subscribe & Save${savings?.savingsPercent ? ` ${savings.savingsPercent}%` : ''}!`}
												</p>
											) : auth.user ? (
												// --- Logged In View --- 
												<label className="flex items-center space-x-2 text-sm cursor-pointer">
													<input 
														type="checkbox" 
														name={`subscribe-${priceOpt.priceId}`}
														value={priceOpt.priceId} // Value identifies the base price
														// Checked state depends on global isSubscribed AND if this radio is selected
														checked={isSubscribed && selectedPriceId === priceOpt.priceId} 
														onChange={handleSubscriptionCheckboxChange}
														className="form-checkbox h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
													/>
													<span className="font-medium text-indigo-700">
														Subscribe & Save {savings?.savingsPercent ? `${savings.savingsPercent}%` : ''}
													</span>
												</label>
											) : null /* Don't show anything while auth is loading */}
										</div>
									)}
								</div>
							);
						})}
						{displayablePrices.length === 0 && <p className="text-red-600">No purchase options available.</p>}
					</div>

					{/* Ingredients/Allergens */}
					<div className="text-sm text-slate-500 pt-4 border-t border-slate-200">
						{/* Use boolean flags directly from FlavorType */}
						<p><span className="font-semibold text-slate-600">Contains:</span> {flavorData.hasDairy ? 'Dairy' : ''}{flavorData.hasDairy && flavorData.hasEgg ? ', ' : ''}{flavorData.hasEgg ? 'Egg' : ''}{!flavorData.hasDairy && !flavorData.hasEgg ? 'Check packaging for details' : ''}</p>
					</div>

					{/* Quantity Selector */}
					<div className="flex items-center space-x-3 pt-3">
						<label htmlFor="quantity" className="font-medium text-slate-700">Quantity:</label>
						<div className="flex items-center border border-slate-300 rounded-md overflow-hidden shadow-sm">
							<button onClick={() => handleQuantityChange(-1)} className="px-3 py-1.5 text-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200 ease-in-out">-</button>
							<input
								id="quantity"
								type="number"
								value={quantity}
								readOnly
								className="w-12 text-center border-l border-r border-slate-300 py-1.5 focus:outline-none text-slate-700 font-medium"
							/>
							<button onClick={() => handleQuantityChange(1)} className="px-3 py-1.5 text-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200 ease-in-out">+</button>
						</div>
					</div>

					{/* Add to Cart Button - Accent Color */}
					<div className="pt-5">
						<button
							onClick={handleAddToCart}
							// Disable if no effective price is selected or no displayable prices available
							disabled={!flavorData || !selectedEffectivePrice || displayablePrices.length === 0 || (isSubscribed && !auth.user)}
							className={`w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-300 ease-in-out flex items-center justify-center space-x-2 shadow hover:shadow-md ${!flavorData || !selectedEffectivePrice || displayablePrices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
						>
							<span className="material-symbols-outlined">add_shopping_cart</span>
							<span>{selectedEffectivePrice?.isSubscription ? 'Add Subscription to Cart' : 'Add to Cart'}</span>
						</button>
					</div>

				</div>
			</div>
		</div>
	)
}
