import React from 'react'

import { header } from '../../utils/content'

export const Header = () => {
	return (
		<div id="header" className='flex mt-4 p-8 mx-4 shadow-md rounded-xl justify-between items-center bg-blue-600'>

			<div className='flex justify-start'>
				<img className="w-10" src="/images/logo.png"></img>

				{header.links.filter(link => link.active).map((link, i) => 
					<a key={i} href={link.link} className='header-link'>
						{link.text}
					</a>
				)}

			</div>

			<div className='flex'>
				{header.searchActive &&
					<span className="text-3xl ml-8 material-symbols-outlined">
						search
					</span>
				}
				{header.shoppingActive &&
					<span className="text-3xl ml-8 material-symbols-outlined">
						shopping_cart
					</span>
				}
			</div>

		</div>
	)
}
