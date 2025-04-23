import React from 'react'

export const Shipping = () => {
	return (
		<div className='grow container mx-auto px-4 py-8 md:py-16'>
			<h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">Shipping Information</h1>
			<div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md prose prose-lg text-gray-700">
				<p>
					We currently ship our abominably delicious ice cream packed in dry ice to ensure it arrives frozen and ready to enjoy. Shipping costs and delivery times vary based on location. Please proceed to checkout to see available options for your address.
				</p>
				{/* Add more detailed shipping policy text here */}
			</div>
		</div>
	)
}
