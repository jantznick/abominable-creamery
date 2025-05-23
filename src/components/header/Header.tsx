import React, { useState } from 'react'
import classNames from 'classnames';
import { Link, useNavigate } from 'react-router-dom';

import { header, siteData } from '../../utils/content'
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../auth/LoginModal';
import SignupModal from '../auth/SignupModal';
import ForgotPasswordModal from '../auth/ForgotPasswordModal';
import { CartHoverCard } from './CartHoverCard';

export const Header = () => {
	const [toggleSearch, setToggleSearch] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isCartHovered, setIsCartHovered] = useState(false);
	const navigate = useNavigate();
	const { items, getCartTotal, getItemCount } = useCart();
	const { 
		user, 
		isLoading, 
		logout, 
		isLoginOpen, 
		openLogin, 
		closeLogin, 
		isSignupOpen, 
		openSignup, 
		closeSignup,
		switchToLogin,
		switchToSignup,
		isForgotPasswordOpen,
		openForgotPassword,
		closeForgotPassword,
		switchToForgotPassword
	} = useAuth();

	const itemCount = getItemCount();
	const cartTotal = getCartTotal();

	const handleLogout = async () => {
		console.log("Header: Logging out...");
		await logout();
		console.log("Header: Logout completed.");
		setIsMobileMenuOpen(false);
	}

	const handleSearch = () => {
		setToggleSearch(false)
		navigate(`search?flavor=${searchTerm}`)
		setSearchTerm('');
	}

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	return (
		<div
			id="header"
			className='relative flex justify-between items-center mt-3 p-4 md:p-5 lg:p-6 mx-2 md:mx-4 shadow-lg rounded-xl bg-gradient-to-b from-indigo-700 to-indigo-800'
		>
			<div className="flex items-center space-x-4 md:space-x-6 lg:space-x-8">
				<Link 
					to="/" 
					className="flex-shrink-0 flex items-center space-x-3 opacity-90 hover:opacity-100 transition-opacity"
				>
					<img 
						className="w-10 h-10 md:w-11 md:h-11" 
						src="/images/logo-white.png" 
						alt="Abominable Creamery Logo"
					/>
					<span className="text-3xl font-bold text-white">
						{siteData.name.toUpperCase()}
					</span>
				</Link>
				<div className='hidden md:flex items-center space-x-3 lg:space-x-4'>
					{header.links.filter(link => link.active).map((link, i) =>
						<Link 
							key={i} 
							to={link.link} 
							className='header-link text-indigo-100 hover:text-white hover:bg-indigo-600/60 px-3 py-2 rounded-md text-sm lg:text-base font-medium transition-colors duration-200'
						>
							{link.text}
						</Link>
					)}
				</div>
			</div>

			<div className="flex items-center space-x-3 md:space-x-4">
				{header.searchActive &&
					<div className={classNames(
						'items-center group', 
						{ 'flex': toggleSearch, 'hidden md:flex': !toggleSearch }
					)}>
						<input
							type="text"
							placeholder='Find a Flavor...'
							value={searchTerm}
							className={classNames(
								'transition-all duration-300 ease-in-out',
								'rounded-full',
								'py-1.5 px-4',
								'w-32 sm:w-40 md:w-48 lg:w-64',
								'focus-visible:outline-none focus:ring-2 focus:ring-indigo-300',
								'text-gray-900'
							)}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					</div>
				}
				<span
					onClick={() => setToggleSearch(!toggleSearch)} 
					className="text-3xl hover:cursor-pointer material-symbols-outlined text-indigo-100 hover:text-white transition-colors duration-200"
				>
					search
				</span>
				
				{header.shoppingActive && (
					<div 
						className="relative"
						onMouseEnter={() => setIsCartHovered(true)}
						onMouseLeave={() => setIsCartHovered(false)}
					>
						<Link 
							to="/cart" 
							className="relative text-3xl hover:cursor-pointer material-symbols-outlined text-indigo-100 hover:text-white transition-colors duration-200 flex items-center justify-center"
							aria-label={`Shopping cart with ${itemCount} items`}
						>
							shopping_cart
							{itemCount > 0 && (
								<span className="absolute -top-1 -right-2 flex items-center justify-center w-5 h-5 bg-amber-400 text-indigo-900 text-xs font-bold rounded-full">
									{itemCount}
								</span>
							)}
						</Link>

						{isCartHovered && (
							<CartHoverCard items={items} total={cartTotal} itemCount={itemCount} />
						)}
					</div>
				)}

				<div className="hidden md:flex items-center space-x-2 lg:space-x-3">
					{isLoading ? (
						<span className="text-indigo-100 text-sm">Loading...</span>
					) : user ? (
						<>
							<Link to="/profile" className="text-indigo-100 text-sm hidden lg:inline">
								Hi, {user.name || user.email}
							</Link>
							<button
								onClick={handleLogout}
								className="header-link text-indigo-100 hover:text-white hover:bg-indigo-600/60 px-3 py-2 rounded-md text-sm lg:text-base font-medium transition-colors duration-200"
							>
								Logout
							</button>
						</>
					) : (
						<>
							<button
								onClick={openLogin}
								className="header-link text-indigo-100 hover:text-white hover:bg-indigo-600/60 px-3 py-2 rounded-md text-sm lg:text-base font-medium transition-colors duration-200"
							>
								Login
							</button>
							<button
								onClick={openSignup}
								className="header-link text-white bg-amber-500 hover:bg-amber-600 px-3 py-2 rounded-md text-sm lg:text-base font-medium transition-colors duration-200 shadow"
							>
								Sign Up
							</button>
						</>
					)}
				</div>

				<div className="md:hidden flex items-center">
					<button
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						type="button"
						className="inline-flex items-center justify-center p-1 rounded-md text-indigo-200 hover:text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors duration-200"
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

			<div 
				className={classNames(
					'md:hidden w-full absolute top-full left-0 right-0 bg-gradient-to-b from-indigo-800 to-indigo-900 z-20 shadow-lg rounded-b-xl overflow-hidden border-t border-indigo-500/50 transition-all duration-300 ease-in-out',
					{ 'max-h-screen opacity-100 visible pt-4 pb-5': isMobileMenuOpen, 'max-h-0 opacity-0 invisible': !isMobileMenuOpen } 
				)}
				id="mobile-menu"
			>
				<div className="px-4 space-y-2">
					{header.links.filter(link => link.active).map((link, i) =>
						<Link
							key={i}
							to={link.link}
							className='header-link text-indigo-100 hover:bg-indigo-600/80 hover:text-white block px-3 py-3 rounded-md text-lg font-medium transition-colors duration-200'
							onClick={() => setIsMobileMenuOpen(false)}
						>
							{link.text}
						</Link>
					)}

					<div className="pt-4 border-t border-indigo-700">
						{isLoading ? (
							<span className="text-indigo-100 block px-3 py-3 text-lg font-medium">Loading...</span>
						) : user ? (
							<>
								<span className="text-indigo-100 block px-3 py-3 text-lg font-medium">Hi, {user.name || user.email}</span>
								<Link
									to="/profile"
									className='w-full text-left header-link text-indigo-100 hover:bg-indigo-600/80 hover:text-white block px-3 py-3 rounded-md text-lg font-medium transition-colors duration-200'
									onClick={() => setIsMobileMenuOpen(false)}
								>
									Profile
								</Link>
								<button
									onClick={handleLogout}
									className='w-full text-left header-link text-indigo-100 hover:bg-indigo-600/80 hover:text-white block px-3 py-3 rounded-md text-lg font-medium transition-colors duration-200'
								>
									Logout
								</button>
							</>
						) : (
							<>
								<button
									onClick={openLogin}
									className='w-full text-left header-link text-indigo-100 hover:bg-indigo-600/80 hover:text-white block px-3 py-3 rounded-md text-lg font-medium transition-colors duration-200'
								>
									Login
								</button>
								<button
									onClick={openSignup}
									className='w-full text-left header-link text-white bg-amber-500 hover:bg-amber-600 block px-3 py-3 rounded-md text-lg font-medium transition-colors duration-200 mt-2 shadow'
								>
									Sign Up
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			<LoginModal
				isOpen={isLoginOpen}
				onClose={closeLogin}
				onSwitchToSignup={switchToSignup}
				onSwitchToForgotPassword={switchToForgotPassword}
			/>
			<SignupModal
				isOpen={isSignupOpen}
				onClose={closeSignup}
				onSwitchToLogin={switchToLogin}
			/>
			<ForgotPasswordModal
				isOpen={isForgotPasswordOpen} 
				onClose={closeForgotPassword}
				onSwitchToLogin={switchToLogin}
			/>
		</div>
	)
}
