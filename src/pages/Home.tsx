import React from 'react'
import { Link } from 'react-router-dom'

import { siteData, flavors } from '../utils/content'
import { MiniFlavorCard } from '../components/MiniFlavorCard'

export const Home = () => {
	// Select first 4 flavors as featured
	const featuredFlavors = flavors.slice(0, 4);

	return (
		<div className='grow flex flex-col space-y-8 md:space-y-12 py-8 bg-slate-50'>

			{/* --- Hero Section (Constrained Width) --- */}
			<div className="relative bg-indigo-700 overflow-hidden min-h-[50vh] md:min-h-[60vh] flex items-center justify-center text-center 
			                mx-2 md:mx-4 rounded-xl shadow-lg p-4 md:p-8">
				<img
					src="/images/hero-background.jpg" // Replace with a real, high-quality image
					alt="Delicious ice cream scoops"
					className="absolute inset-0 w-full h-full object-cover opacity-30 z-0 rounded-xl"
				/>
				<div className="relative z-10 max-w-3xl mx-auto">
					<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-4">
						{siteData.name}
					</h1>
					<p className="text-xl md:text-2xl text-indigo-200 mb-8">
						{siteData.tagline}
					</p>
					<Link
						to="/flavors"
						className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-full text-lg transition duration-300 ease-in-out transform hover:scale-105 shadow hover:shadow-md"
					>
						Explore Flavors
					</Link>
				</div>
			</div>

			{/* --- Featured Flavors Section (Constrained Width) --- */}
			<div className="bg-white mx-2 md:mx-4 rounded-xl shadow-md p-6 md:p-10 border border-slate-100">
				<div className="max-w-7xl mx-auto">
					<h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-10 md:mb-16">
						Our Most Legendary Flavors
					</h2>
					<div className='flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-9'>
						{featuredFlavors.map((flavor, i) => (
							<MiniFlavorCard flavor={flavor} key={i} />
						))}
					</div>
					<div className="text-center mt-12 md:mt-16">
						<Link
							to="/flavors"
							className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-3 px-8 rounded-full text-lg transition-colors duration-300 ease-in-out"
						>
							See All Flavors
						</Link>
					</div>
				</div>
			</div>

			{/* --- Add other sections as needed (e.g., About Snippet, Testimonials) --- */}

		</div>
	)
}
