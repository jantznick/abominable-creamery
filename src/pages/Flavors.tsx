import React from 'react'

import { flavors } from '../utils/content'
import { MiniFlavorCard } from '../components/MiniFlavorCard'

export const Flavors = () => {
	return (
		<div className='grow'>
			<div>Flavors</div>

			<div className='flex flex-wrap w-4/5 m-auto justify-center'>

				{flavors.map((flavor, i) =>
					<MiniFlavorCard flavor={flavor} key={i} />
				)}

			</div>
		</div>
	)
}
