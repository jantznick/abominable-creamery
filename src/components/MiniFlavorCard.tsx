import React from 'react'
import { Link } from 'react-router-dom'

// Define an interface for the flavor prop
interface FlavorData {
	id: string;
	name: string;
	simpleName?: string; // Optional based on usage
	description?: string; // Optional based on usage
	imageSrc?: string; // Optional based on usage
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
			className='flex flex-col w-full sm:w-[calc(50%-1rem)] lg:w-[calc(25%-1.5rem)] p-4 md:p-6 rounded-lg shadow-md border-black border-2 hover:shadow-lg transition-shadow duration-200 bg-white'
		>
			<div className='aspect-square overflow-hidden rounded-md'>
				<img
					className="w-full h-full object-cover"
					src={flavor.imageSrc || `/images/${colors[randomNumber]}-soon.png`}
					alt={flavor.name}
				/>
			</div>

			<div className='font-bold mt-4 text-lg md:text-xl text-gray-800'>{flavor.name}</div>
			<div className='text-sm text-gray-600'>{flavor.simpleName}</div>

			<div className='mt-4 flex-grow'>
				<div className='text-sm md:text-base text-gray-700 line-clamp-3'>{flavor.description}</div>
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