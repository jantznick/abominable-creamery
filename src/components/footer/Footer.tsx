import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { footerColumns } from '../../utils/content'

// --- Refactored FooterColumn --- 
interface FooterLink {
	text: string;
	ahref: string;
}
interface FooterColumnData {
	title: string;
	links: FooterLink[];
}
const FooterColumn: React.FC<{ column: FooterColumnData }> = ({ column }) => {
	return (
		// Removed mx-4, added text alignment for mobile stack
		<div className='flex flex-col text-center md:text-left'>
			<div className="footer-link-title uppercase font-semibold tracking-wider mb-4 text-indigo-200 text-sm">
				{column.title}
			</div>
			<div className="flex flex-col space-y-2">
				{column.links.map((link, i) => {
					// Use Link for internal routes, a for external/mailto/tel
					const isInternal = link.ahref.startsWith('/');
					const commonClasses = 'text-indigo-100 hover:text-white text-sm transition-colors duration-200';
					if (isInternal) {
						return <Link to={link.ahref} key={i} className={commonClasses}>{link.text}</Link>;
					} else {
						return <a href={link.ahref} key={i} className={commonClasses} target="_blank" rel="noopener noreferrer">{link.text}</a>;
					}
				})}
			</div>
		</div>
	)
}
// --- End Refactored FooterColumn --- 

export const Footer = () => {

	const navigate = useNavigate();

	return (
		<div className='rounded-xl bg-gradient-to-t from-indigo-800 to-indigo-700 text-indigo-100 flex flex-col p-6 md:p-8 lg:p-10 mx-2 md:mx-4 mb-4 shadow-lg'>

			{/* Footer Top: Use Flexbox for Logo | Links structure */}
			<div className="flex flex-col md:flex-row justify-between items-center md:items-start w-full gap-8">
				{/* Logo Column */}
				<div className="flex-shrink-0 flex justify-center md:justify-start">
					<Link to="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
						<img className="w-auto max-h-16 md:max-h-20" src="/images/logo-white.png" alt="Abominable Creamery Logo"></img>
					</Link>
				</div>
				{/* Link Columns Container - Aligned Right */}
				<div className="flex flex-col md:flex-row md:justify-end gap-8 md:gap-10 lg:gap-16 w-full md:w-auto">
					{footerColumns.map((column, i) =>
						<FooterColumn column={column} key={i} />
					)}
				</div>
			</div>

			<div className="flex flex-col md:flex-row justify-between items-center w-full mt-8 md:mt-10 space-y-6 md:space-y-0 border-t border-indigo-600/70 pt-6 md:pt-8">

				<div className="w-full md:w-1/2 lg:w-1/3 text-center md:text-left">
					<div className='flex text-sm md:text-base items-center w-full justify-center md:justify-start mb-3'>
						<span className="material-symbols-outlined mr-2 text-indigo-300">
							email
						</span>
						<div className='uppercase font-semibold tracking-wide text-indigo-100'>Subscribe to our newsletter</div>
					</div>
					<div className='flex flex-col sm:flex-row gap-2 items-stretch'>
						<input 
							type="email" 
							className='flex-grow bg-indigo-600/50 border border-indigo-500/50 text-white rounded-md px-4 py-2.5 focus-visible:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 placeholder-indigo-200 shadow-inner'
							placeholder='Enter your email' 
						/>
						<button className='bg-amber-500 text-amber-900 flex-shrink-0 font-bold uppercase rounded-md px-5 py-2.5 hover:bg-amber-400 transition-colors duration-200 ease-in-out flex items-center justify-center space-x-1 text-sm shadow hover:shadow-md'>
							<span>Subscribe</span>
							<span className="material-symbols-outlined text-lg">keyboard_arrow_right</span>
						</button>
					</div>
				</div>

				<div onClick={() => navigate('/stores') } className='w-full md:w-auto flex justify-center md:justify-end hover:cursor-pointer group'>
					<div className='flex text-sm md:text-base items-center w-auto border border-indigo-500/50 px-5 py-3 rounded-lg group-hover:bg-indigo-600/60 group-hover:border-indigo-300 transition-colors duration-200 ease-in-out shadow hover:shadow-md'>
						<span className="material-symbols-outlined mr-2 text-indigo-300">
							map
						</span>
						<div className='uppercase font-semibold tracking-wide text-indigo-100'>Find Store</div>
					</div>
				</div>

			</div>

		</div>
	)
}
