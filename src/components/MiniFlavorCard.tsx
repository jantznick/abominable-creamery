import React from 'react'
import { Link } from 'react-router-dom'

// Define an interface for the flavor prop
interface FlavorData {
	id: string;
	name: string;
	simpleName?: string; // Optional based on usage
	description?: string; // Optional based on usage
	imageSrc?: string; // Optional based on usage
	price?: string;
}

// Define props type for the component
interface MiniFlavorCardProps {
	flavor: FlavorData;
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

	return (
		<Link
			to={`/flavors/${flavor.id}`}
			className='group flex flex-col w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)] rounded-lg shadow-md border border-slate-200 hover:shadow-lg transform transition duration-300 ease-in-out hover:-translate-y-1 bg-white overflow-hidden'
		>
			<div className='aspect-square overflow-hidden'>
				<img
					className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
					src={flavor.imageSrc || `/images/${colors[randomNumber]}-soon.png`}
					alt={flavor.name}
				/>
			</div>

			<div className='flex flex-col flex-grow p-4'>
				<h3 className='font-semibold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors duration-200 leading-tight'>{flavor.name}</h3>
				{flavor.simpleName && <p className='text-sm text-slate-500 mb-2'>{flavor.simpleName}</p>}
				
				<p className='text-sm text-slate-600 line-clamp-3 mb-3 flex-grow'>{flavor.description}</p>

				{flavor.price && (
					<p className="font-semibold text-lg text-amber-600 mt-auto pt-2">${flavor.price}</p>
				)}
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