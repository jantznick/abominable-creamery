import React from 'react'
import { useProducts } from '../context/ProductContext';
import { MiniFlavorCard } from '../components/MiniFlavorCard'

export const Flavors = () => {
	const { flavors } = useProducts();

	return (
		<div className='grow'>
			<div className='px-4 md:px-8 lg:px-16 py-8 max-w-7xl mx-auto flex flex-wrap justify-center gap-4 md:gap-8'>

				{flavors.length === 0 && (
					<p>Loading flavors or no flavors available...</p>
				)}
				{flavors.map((flavor) =>
					<MiniFlavorCard flavor={flavor} key={flavor.id} />
				)}

			</div>
		</div>
	)
}
