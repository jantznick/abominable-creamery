import React from 'react'
import { Link } from 'react-router-dom'
import { Flavor } from '../types/flavor' // Import the correct Flavor type

// Remove the outdated local interface
// interface FlavorData { ... }

// Update props to use the imported Flavor type
interface MiniFlavorCardProps {
	flavor: Flavor;
}

export const MiniFlavorCard: React.FC<MiniFlavorCardProps> = ({flavor}) => {
	// Define type for the colors object keys
	type ColorKey = 0 | 1 | 2;
	const randomNumber = Math.floor(Math.random() * 3) as ColorKey;
	const colors: Record<ColorKey, string> = {
		0: 'green',
		1: 'pink',
		2: 'blue'
	};

	// Separate default price from other prices
	const defaultPrice = flavor.prices.find(p => p.isDefault);
	const otherPrices = flavor.prices.filter(p => !p.isDefault);

	return (
		<Link
			// Use slug for the URL, fallback if missing
			to={flavor.slug ? `/flavors/${flavor.slug}` : '/flavors'} 
			// Add a title attribute for better UX if slug is missing
			title={!flavor.slug ? 'Flavor details unavailable' : flavor.name}
			className={`group flex flex-col w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)] rounded-lg shadow-md border border-slate-200 hover:shadow-lg transform transition duration-300 ease-in-out hover:-translate-y-1 bg-white overflow-hidden ${
				!flavor.slug ? 'opacity-70 pointer-events-none' : '' // Visually indicate if link is just a fallback
			}`}
		>
			<div className='aspect-square overflow-hidden'>
				<img
					className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
					// Use flavor.imageSrc which comes from Stripe now
					src={flavor.imageSrc || `/images/${colors[randomNumber]}-soon.png`} 
					alt={flavor.name}
				/>
			</div>

			<div className='flex flex-col flex-grow p-4'>
				<h3 className='font-semibold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors duration-200 leading-tight'>{flavor.name}</h3>
				{flavor.simpleName && <p className='text-sm text-slate-500 mb-2'>{flavor.simpleName}</p>}
				
				{/* Handle potentially null description */} 
				<p className='text-sm text-slate-600 line-clamp-3 mb-3 flex-grow'>{flavor.description || 'No description available.'}</p> 

				{/* Display prices: Default first, then others */}
				<div className="mt-auto pt-2">
					{/* Render default price if it exists */} 
					{defaultPrice && (
						<p key={defaultPrice.priceId} className="font-semibold text-lg text-amber-700"> {/* Slightly different style? */} 
							{defaultPrice.displayName || defaultPrice.unitDescription || 'Default'}: ${defaultPrice.price}
						</p>
					)}
					{/* Render other prices */} 
					{otherPrices.map(priceOpt => (
						<p key={priceOpt.priceId} className="font-semibold text-md text-amber-600"> {/* Original style */} 
							{priceOpt.displayName || priceOpt.unitDescription || 'Option'}: ${priceOpt.price}
						</p>
					))}
					{/* Handle case where no prices exist at all */} 
					{flavor.prices.length === 0 && (
						<p className="font-semibold text-md text-red-600">Not available</p>
					)}
				</div>
			</div>
		</Link>
	)
}

{/* "id": "yeti-vanilla-dream",
"name": "Yeti Vanilla Dream",
"simpleName": "Vanilla",
"description": "A rich and creamy vanilla ice cream made from the finest Madagascar vanilla beans. Pure, aromatic, and timeless.",
"price": "5.99",
"hasDairy": true,
"hasEgg": true,
"withoutDairy": false,
"withoutEgg": false */}