import React from 'react'

export const Header = () => {
	return (
		<div className='flex p-4 justify-between items-center'>
			<div className='flex justify-start'>
				<div>Logo</div>
				<a href="flavors" className='header-link'>
					Flavors
				</a>
				<a href="story" className='header-link'>
					Story
				</a>
				<a href="contact" className='header-link'>
					Contact
				</a>
				<a href="shipping" className='header-link'>
					Shipping
				</a>
			</div>
			<div className='flex'>

			</div>
		</div>
	)
}
