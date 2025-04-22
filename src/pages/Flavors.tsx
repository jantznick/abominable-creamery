import React from 'react'

import { flavors } from '../utils/content'
import { MiniFlavorCard } from '../components/MiniFlavorCard'

export const Flavors = () => {
	return (
		<div className='grow'>
			<div className='px-4 md:px-8 lg:px-16 py-8 max-w-7xl mx-auto flex flex-wrap justify-center gap-4 md:gap-8'>

				{flavors.map((flavor, i) =>
					<MiniFlavorCard flavor={flavor} key={i} />
				)}

			</div>
		</div>
	)
}
