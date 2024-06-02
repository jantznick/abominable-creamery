import React from 'react'

import { header } from '../../utils/content'

export const Header = () => {
	return (
		<div className='flex p-4 justify-between items-center'>
			<div className='flex justify-start'>
				<img className="w-10" src="/images/logo.png"></img>

				{header.links.filter(link => link.active).map((link, i) => 
					<a key={i} href={link.link} className='header-link'>
						{link.text}
					</a>
				)}

			</div>
			<div className='flex'>

			</div>
		</div>
	)
}
