import React, { useState } from 'react'
import classNames from 'classnames';

import { header } from '../../utils/content'
import { Link, useNavigate } from 'react-router-dom';

export const Header = () => {

	const [toggleSearch, setToggleSearch] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const navigate = useNavigate();

	const handleSearch = () => {
		setToggleSearch(false)
		navigate(`search?flavor=${searchTerm}`)
	}

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		console.log(event);
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	return (
		<div
			id="header"
			className='relative flex flex-col md:flex-row mt-2 p-4 md:mt-4 md:p-8 mx-2 md:mx-4 shadow-md rounded-xl justify-between items-center bg-blue-600 space-y-4 md:space-y-0'
		>

			<div className='w-full flex justify-between items-center'>
				<div className='flex items-center'>
					<Link to="/" className="flex items-center">
						<img className="w-10 h-10" src="/images/logo.png" alt="Logo"></img>
					</Link>
				</div>

				<div className='hidden md:flex md:space-x-6'>
					{header.links.filter(link => link.active).map((link, i) =>
						<Link key={i} to={link.link} className='header-link text-white hover:text-gray-200 px-3 py-2 rounded-md text-sm font-medium'>
							{link.text}
						</Link>
					)}
				</div>

				<div className="md:hidden flex items-center">
					<button
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						type="button"
						className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-gray-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
						aria-controls="mobile-menu"
						aria-expanded={isMobileMenuOpen}
					>
						<span className="sr-only">Open main menu</span>
						<svg className={classNames('h-6 w-6', { 'hidden': isMobileMenuOpen, 'block': !isMobileMenuOpen })} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
						<svg className={classNames('h-6 w-6', { 'block': isMobileMenuOpen, 'hidden': !isMobileMenuOpen })} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div className='w-full flex items-center justify-center md:w-auto md:justify-end mt-4 md:mt-0'>
				{header.searchActive &&
					<div className='flex items-center w-full max-w-xs md:max-w-none md:w-auto'>
						<input
							type="text"
							placeholder='Find a Flavor...'
							className={classNames(
								'duration-200',
								'origin-right',
								'rounded-xl',
								'py-2',
								'px-4',
								'w-full md:w-auto md:min-w-80',
								'focus-visible:outline-none',
								'text-gray-800',
								{ 'scale-x-100 opacity-100 ml-2': toggleSearch, 'scale-x-0 opacity-0': !toggleSearch }
							)}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
						<span
							onClick={toggleSearch ? handleSearch : () => setToggleSearch(!toggleSearch)}
							className="text-3xl ml-2 hover:cursor-pointer material-symbols-outlined text-white"
						>
							search
						</span>
					</div>
				}
				{header.shoppingActive &&
					<span className="text-3xl ml-4 material-symbols-outlined text-white hover:cursor-pointer">
						shopping_cart
					</span>
				}
			</div>

			<div className={classNames('md:hidden w-full absolute top-full left-0 bg-blue-600 z-20 shadow-lg rounded-b-xl transition-transform duration-300 ease-in-out', { 'max-h-screen opacity-100': isMobileMenuOpen, 'max-h-0 opacity-0 overflow-hidden': !isMobileMenuOpen })} id="mobile-menu">
				<div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
					{header.links.filter(link => link.active).map((link, i) =>
						<Link
							key={i}
							to={link.link}
							className='header-link text-white hover:bg-blue-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium'
							onClick={() => setIsMobileMenuOpen(false)}
						>
							{link.text}
						</Link>
					)}
				</div>
			</div>

		</div>
	)
}
