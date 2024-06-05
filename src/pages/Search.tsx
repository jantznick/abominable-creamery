import React from 'react'
import { useLocation } from 'react-router-dom'
import fuzzysort from 'fuzzysort'

import { flavors } from '../utils/content';
import { MiniFlavorCard } from '../components/MiniFlavorCard';

export const Search = () => {
	const searchFlavor = new URLSearchParams(useLocation().search).get('flavor');

	const searchResults = fuzzysort.go(searchFlavor, flavors, {
		keys: ['name', 'simpleName', 'description'],
		all: true,
		threshold: 0.2
	})

	return (
		<div className='grow'>
			<div className='w-4/5 m-auto mt-8'>
				<div className='text-2xl font-bold'>Search Results Page</div>
				<p className='mt-4'>Showing search results for: {searchFlavor}</p>
			</div>

			<div className='flex flex-wrap w-4/5 mt-4 mx-auto justify-center'>
				{searchResults.map((result, i) => 
					<MiniFlavorCard flavor={result.obj} key={i} />
				)}
			</div>

			<div className='flex justify-center text-3xl my-8'>
				<a className='px-4 mx-2 py-6 bg-blue-400 hover:bg-blue-600 hover:shadow-lg duration-200 rounded-xl shadow-md' href="/flavors">View All Flavors</a>
			</div>

		</div>
	)
}

