import React from 'react'
import { useNavigate } from 'react-router-dom'

import { footerColumns } from '../../utils/content'
import { FooterColumn } from './FooterColumn'

export const Footer = () => {

	const navigate = useNavigate();

	return (
		<div className='rounded-xl min-w-full bg-blue-600 text-white flex flex-col md:flex-wrap p-4 md:p-8 mx-2 md:mx-4 mb-4 shadow-md'>

			<div className="footer-top flex flex-col md:flex-row justify-between w-full space-y-8 md:space-y-0">
				<div className="footer-logo w-full md:w-[33%] flex justify-center md:justify-start">
					<img className="w-auto max-h-16 md:max-h-full md:max-w-32" src="/images/logo-white.png"></img>
				</div>
				<div className="footer-links grow flex flex-col space-y-8 md:flex-row md:justify-between md:space-y-0">
					{footerColumns.map((column, i) =>
						<FooterColumn column={column} key={i} />
					)}
				</div>
			</div>

			<div className="footer-bottom flex flex-col md:flex-row justify-between w-full mt-8 md:mt-16 space-y-8 md:space-y-0 md:items-end">

				<div className="w-full md:w-auto">
					<div className='flex text-base md:text-xl items-center w-full'>
						<span className="material-symbols-outlined">
							email
						</span>
						<div className='ml-2 uppercase font-semibold'>Subscribe to our newsletter</div>
					</div>

					<div className='border-white border-[1px] rounded-full flex flex-col sm:flex-row mt-4 md:mt-6 text-sm items-stretch sm:items-center'>
						<div className='flex-grow ml-4 sm:ml-6 py-2 sm:py-0'>
							<input type="text" className='bg-blue-600 w-full p-2 focus-visible:outline-none placeholder-gray-300' placeholder='Enter your email' />
						</div>
						<div className='bg-blue-300 text-blue-800 flex font-bold uppercase justify-center items-center rounded-full m-2 py-3 px-6 sm:ml-4 hover:bg-blue-200 cursor-pointer'>
							Subscribe
							<span className="material-symbols-outlined ml-1">keyboard_arrow_right</span>
						</div>
					</div>
				</div>

				<div onClick={() => navigate('/stores') } className='w-full md:w-auto flex flex-col justify-end items-center md:items-end hover:cursor-pointer'>
					<div className='flex text-base md:text-xl items-center w-full md:w-auto border-[1px] border-white p-3 md:p-4 rounded-xl hover:bg-blue-500 transition-colors duration-200'>
						<span className="material-symbols-outlined">
							map
						</span>
						<div className='ml-2 uppercase font-semibold'>Find Store</div>
					</div>
				</div>

			</div>

		</div>
	)
}
