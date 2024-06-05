import React from 'react'
import { useNavigate } from 'react-router-dom'

import { footerColumns } from '../../utils/content'
import { FooterColumn } from './FooterColumn'

export const Footer = () => {

	const navigate = useNavigate();

	return (
		<div className='rounded-xl min-w-100% bg-blue-600 text-white flex flex-wrap p-8 mx-4 mb-4 shadow-md'>

			<div className="footer-top flex justify-between w-full">
				<div className="footer-logo w-[33%] flex">
					<img className="w-full max-w-32" src="/images/logo-white.png"></img>
				</div>
				<div className="footer-links grow flex justify-between">
					{footerColumns.map((column, i) =>
						<FooterColumn column={column} key={i} />
					)}
				</div>
			</div>

			<div className="footer-bottom flex justify-between w-full mt-16">

				<div>
					<div className='flex text-xl items-center w-full'>
						<span className="material-symbols-outlined">
							email
						</span>
						<div className='ml-2 uppercase'>Subscribe to our newsletter</div>
					</div>

					<div className='border-white border-[1px] rounded-full flex mt-6 text-sm items-center'>
						<div className='ml-6'>
							<input type="text" className='bg-blue-600 p-2 focus-visible:outline-none' placeholder='Enter your email' />
						</div>
						<div className='bg-blue-300 flex font-bold uppercase justify-center items-center rounded-full m-2 py-2 px-6 ml-4'>Subscribe <span className="material-symbols-outlined">keyboard_arrow_right</span></div>
					</div>
				</div>

				<div onClick={() => navigate('/stores') } className='flex flex-col justify-end hover:cursor-pointer'>
					<div className='flex text-xl items-center w-full border-[1px] border-white p-4 rounded-xl'>
						<span className="material-symbols-outlined">
							map
						</span>
						<div className='ml-2 uppercase'>Find Store</div>
					</div>
				</div>

			</div>

		</div>
	)
}
