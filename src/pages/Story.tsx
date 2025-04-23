import React from 'react'

export const Story = () => {
	return (
		<div className='grow container mx-auto px-4 py-8 md:py-16'>
			<h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">Our Chillingly Delicious Story</h1>

			<div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md">
				{/* Placeholder Image */}
				<img 
					src="/images/story-placeholder.jpg" // Replace with a real image
					alt="Inside the Abominable Creamery"
					className="w-full h-64 md:h-80 object-cover rounded-lg mb-8 shadow-sm"
				/>

				<div className="prose prose-lg max-w-none text-gray-700">
					<p>
						Legend tells of a creature, mythical and immense, dwelling high in the frozen peaks – the Yeti. But we know the *real* legend wasn't just about snow and mystery... it was about ice cream.
					</p>
					<p>
						Born from a blizzard of inspiration and a flurry of forgotten recipes found etched in glacial ice, Abominable Creamery was founded on a simple principle: create the most unbelievably delicious, intensely flavored ice cream this side of the Himalayas. We believe in using only the finest ingredients, sourced from frosty farms and enchanted valleys (well, almost!).
					</p>
					<p>
						Our journey started small, with a single, slightly frostbitten churn and a dream bigger than a snowball fight in July. We experimented relentlessly, blending classic techniques with unexpected twists, always chasing that perfect scoop – the kind that makes you say, "Wow, that's abominably good!"
					</p>
					<p>
						From the creamiest vanilla to the most adventurous, monster-inspired concoctions, every flavor tells a story. It's a story of passion, quality, and a little bit of high-altitude magic. We invite you to grab a spoon, brave the cold, and taste the legend for yourself.
					</p>
				</div>
			</div>
		</div>
	)
}
