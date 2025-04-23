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

	// Find the default price or the first price if none is default (e.g., single pint price)
	// For simplicity, let's just take the first price for display here.
	// A more robust approach might involve sorting or checking metadata.
	const displayPrice = flavor.prices.length > 0 ? flavor.prices[0] : null;

	return (
		<Link
			to={`/flavors/${flavor.id}`}
			className='group flex flex-col w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)] rounded-lg shadow-md border border-slate-200 hover:shadow-lg transform transition duration-300 ease-in-out hover:-translate-y-1 bg-white overflow-hidden'
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

				{/* Display the price options */}
				<div className="mt-auto pt-2">
					{flavor.prices.map(priceOpt => (
						<p key={priceOpt.priceId} className="font-semibold text-md text-amber-600">
							${priceOpt.price} {priceOpt.unitDescription ? `(${priceOpt.unitDescription})` : ''}
						</p>
					))}
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