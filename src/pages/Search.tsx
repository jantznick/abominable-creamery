import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import fuzzysort from 'fuzzysort'
import { useProducts } from '../context/ProductContext';
import { MiniFlavorCard } from '../components/MiniFlavorCard';

export const Search = () => {
	const { flavors } = useProducts();
	const searchFlavor = new URLSearchParams(useLocation().search).get('flavor');

	const searchTerm = searchFlavor ?? '';
	const searchResults = fuzzysort.go(searchTerm, flavors, {
		keys: ['name', 'simpleName', 'description'],
		threshold: -10000
	})

	return (
		<div className='grow'>
			<div className='px-4 md:px-8 lg:px-16 max-w-7xl mx-auto py-8'>
				<div className='text-2xl md:text-3xl font-bold'>Search Results</div>
				<p className='mt-2 md:mt-4 text-base md:text-lg'>Showing results for: <span className="font-semibold">{searchTerm}</span></p>
			</div>

			<div className='px-4 md:px-8 lg:px-16 max-w-7xl mx-auto flex flex-wrap justify-center gap-4 md:gap-8 pb-8'>
				{searchResults.length > 0 ? (
					searchResults.map((result) =>
						<MiniFlavorCard flavor={result.obj} key={result.obj.id} />
					)
				) : (
					<p className="text-center text-gray-600 col-span-full py-12">No flavors found matching your search.</p>
				)}
			</div>

			<div className='flex justify-center my-8 md:my-12'>
				<Link className='text-lg md:text-xl px-6 py-3 mx-2 bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg duration-200 rounded-xl shadow-md font-semibold' to="/flavors">
					View All Flavors
				</Link>
			</div>

		</div>
	)
}

