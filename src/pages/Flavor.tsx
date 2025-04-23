import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom';
import { flavors } from '../utils/content';
import { useCart } from '../context/CartContext'; // Import useCart

// Define types (can be shared in a types file later)
interface FlavorData {
	id: string;
	name: string;
	simpleName?: string;
	description?: string;
	price?: string;
	imageSrc?: string;
	hasDairy?: boolean;
	hasEgg?: boolean;
}

// Temporary fallback image logic (same as MiniFlavorCard)
const colors: Record<number, string> = {
	0: 'green',
	1: 'pink',
	2: 'blue'
};

export const Flavor = () => {
	const [quantity, setQuantity] = useState(1); // State for quantity
	const { flavor: flavorId } = useParams<{ flavor: string }>(); // Get ID from URL
	const { addItem } = useCart(); // Get addItem function from context

	// Find the flavor, ensuring type safety
	const flavorData: FlavorData | undefined = flavors.find(f => f.id === flavorId);

	// Handle flavor not found
	if (!flavorData) {
		return (
			<div className='grow flex flex-col items-center justify-center text-center p-8 bg-slate-50'>
				<span className="material-symbols-outlined text-6xl text-amber-500 mb-4">error</span>
				<h1 className="text-2xl md:text-4xl font-bold text-slate-700 mb-4">Oops! Flavor Not Found</h1>
				<p className="text-lg text-slate-500 mb-8">We couldn't find the flavor you were looking for.</p>
				<Link to="/flavors" className='bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 ease-in-out'>
					Back to Flavors
				</Link>
			</div>
		);
	}

	const handleQuantityChange = (amount: number) => {
		setQuantity(prev => Math.max(1, prev + amount)); // Ensure quantity is at least 1
	};

	const handleAddToCart = () => {
		if (!flavorData || !flavorData.price) return; // Guard if flavor or price is missing

		const priceAsNumber = parseFloat(flavorData.price);
		if (isNaN(priceAsNumber)) {
			console.error("Invalid price for flavor:", flavorData.name);
			return; // Don't add if price is not a valid number
		}

		addItem({
			id: flavorData.id,
			name: flavorData.name,
			price: priceAsNumber,
			imageSrc: flavorData.imageSrc // Pass imageSrc if available
		}, quantity);

		console.log(`Adding ${quantity} of ${flavorData.name} to cart`);
		// Reset quantity after adding? Optional: setQuantity(1);
		// Potentially show a confirmation message/toast
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
					<p className="text-base text-slate-700 leading-relaxed">{flavorData.description}</p>

					{/* Price - Use Accent */}
					{flavorData.price && (
						<p className="text-3xl font-semibold text-amber-600">${flavorData.price}</p>
					)}

					{/* Ingredients/Allergens */}
					<div className="text-sm text-slate-500 pt-4 border-t border-slate-200">
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
							// Disable button if flavorData or price is missing
							disabled={!flavorData || !flavorData.price}
							className={`w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-300 ease-in-out flex items-center justify-center space-x-2 shadow hover:shadow-md ${!flavorData || !flavorData.price ? 'opacity-50 cursor-not-allowed' : ''}`}
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
