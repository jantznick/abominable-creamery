import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom';
// import { flavors as staticFlavors } from '../utils/content'; // Remove static import
import { useProducts } from '../context/ProductContext'; // Import product context hook
import { Flavor as FlavorType, PriceOption } from '../types/flavor'; // Import correct types
import { useCart, AddItemPayload } from '../context/CartContext'; // Import useCart AND AddItemPayload from context
// import { AddItemPayload } from '../types/cart'; // Remove incorrect import

// Remove local FlavorData type
// interface FlavorData { ... }

// Temporary fallback image logic (same as MiniFlavorCard)
const colors: Record<number, string> = {
	0: 'green',
	1: 'pink',
	2: 'blue'
};

export const Flavor = () => {
	const [quantity, setQuantity] = useState(1); 
	const [selectedPrice, setSelectedPrice] = useState<PriceOption | null>(null); // State for selected price option
	const { flavor: flavorId } = useParams<{ flavor: string }>(); 
	const { addItem } = useCart(); 
	const { flavors } = useProducts(); // Get flavors from context

	// Find the flavor from context data
	const flavorData: FlavorType | undefined = flavors.find(f => f.id === flavorId);

	// Effect to set the default selected price when flavorData loads/changes
	useEffect(() => {
		if (flavorData && flavorData.prices.length > 0) {
			// Select the first price option by default, or implement logic to find a specific default
			setSelectedPrice(flavorData.prices[0]); 
		} else {
			setSelectedPrice(null);
		}
	}, [flavorData]);

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

	const handlePriceSelectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const priceId = event.target.value;
		const newSelectedPrice = flavorData.prices.find(p => p.priceId === priceId) || null;
		setSelectedPrice(newSelectedPrice);
	};

	const handleAddToCart = () => {
		// Ensure flavor and a price option are selected
		if (!flavorData || !selectedPrice) return; 

		// Ensure addItem is called with the correct payload structure (price as string)
		const itemPayload: AddItemPayload = {
			priceId: selectedPrice.priceId,
			productId: flavorData.id,
			name: `${flavorData.name} ${selectedPrice.unitDescription ? `(${selectedPrice.unitDescription})` : ''}`,
			price: selectedPrice.price, // Pass price as string now
			imageSrc: flavorData.imageSrc || undefined // Ensure undefined if null
		};
		addItem(itemPayload, quantity);

		console.log(`Adding ${quantity} of ${flavorData.name} (${selectedPrice.unitDescription}) with price ID ${selectedPrice.priceId} to cart`);
	};

	// Determine image source
	const randomNum = Math.floor(Math.random() * 3);
	const imageToDisplay = flavorData.imageSrc || `/images/${colors[randomNum]}-soon.png`;

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

					{/* Price Options - Using Radio Buttons */}
					<div className="space-y-2 pt-3">
						<h3 className="text-lg font-medium text-slate-800">Select Option:</h3>
						{flavorData.prices.map((priceOpt) => (
							<label key={priceOpt.priceId} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors duration-150">
								<input
									type="radio"
								name={`priceOption-${flavorData.id}`}
								value={priceOpt.priceId}
								checked={selectedPrice?.priceId === priceOpt.priceId}
								onChange={handlePriceSelectionChange}
								className="form-radio h-5 w-5 text-amber-600 focus:ring-amber-500 border-slate-300"
								/>
								<span className="flex-grow">
									<span className="block text-md font-medium text-slate-700">{priceOpt.unitDescription || 'Standard'}</span>
									{/* Optional: Add packSize info if needed */}
								</span>
								<span className="text-xl font-semibold text-amber-600">${priceOpt.price}</span>
							</label>
						))}
						{flavorData.prices.length === 0 && <p className="text-red-600">No purchase options available.</p>}
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
							// Disable if no price is selected or no prices available
							disabled={!flavorData || !selectedPrice || flavorData.prices.length === 0}
							className={`w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-300 ease-in-out flex items-center justify-center space-x-2 shadow hover:shadow-md ${!flavorData || !selectedPrice || flavorData.prices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
						>
							<span className="material-symbols-outlined">add_shopping_cart</span>
							<span>Add to Cart</span>
						</button>
					</div>

				</div>
			</div>
		</div>
	)
}
