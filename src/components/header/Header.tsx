import React, { useState } from 'react'
import classNames from 'classnames';

import { header } from '../../utils/content'
import { useNavigate } from 'react-router-dom';

export const Header = () => {

	const [toggleSearch, setToggleSearch] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const navigate = useNavigate();

	const handleSearch = () => {
		setToggleSearch(false)
		navigate(`search?flavor=${searchTerm}`)
	}

	const handleKeyDown = (event) => {
		console.log(event);
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

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

			<div className='flex items-center'>
				{header.searchActive &&
					<>
						<input
							type="text"
							placeholder='Find a Flavor...'
							className={classNames(
								'duration-200',
								'origin-right',
								'rounded-xl',
								'py-2',
								'px-4',
								'min-w-80',
								'focus-visible:outline-none',
								{ 'scale-x-0': !toggleSearch }
							)}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
						<span
							onClick={toggleSearch ? handleSearch : () => setToggleSearch(!toggleSearch)}
							className="text-3xl ml-2 hover:cursor-pointer material-symbols-outlined"
						>
							search
						</span>
					</>
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
