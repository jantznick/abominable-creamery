import React from 'react'

export const Contact = () => {
	// Placeholder submit handler
	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		console.log('Form submitted (placeholder)');
		// Add actual form submission logic later (e.g., API call)
		alert('Thank you for your message! (Placeholder)');
	};

	return (
		<div className='grow container mx-auto px-4 py-8 md:py-16'>
			<h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">Contact Us</h1>

			<div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border border-gray-200">
				<p className="text-lg text-gray-700 mb-6 text-center">
					Have a question, suggestion, or just want to say hello? Drop us a line!
				</p>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
						<input
							type="text"
							id="name"
							name="name"
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
						<input
							type="email"
							id="email"
							name="email"
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					<div>
						<label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
						<textarea
							id="message"
							name="message"
							rows={4}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						></textarea>
					</div>
					<div className="text-center">
						<button
							type="submit"
							className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
						>
							Send Message
						</button>
					</div>
				</form>
			</div>

			{/* Optional: Add contact details (email, phone) or a map here later */}

		</div>
	)
}
