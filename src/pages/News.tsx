import React from 'react'
import { newsArticles, NewsArticle } from '../utils/content' // Import news data
import { NewsArticleCard } from '../components/news/NewsArticleCard' // Import the card component
import { PageTitle } from "../components/common/PageTitle"

export const News = () => {
	return (
		<div className='grow container mx-auto px-4 py-8 md:py-16'>
			<PageTitle title="Latest News" />
			
			{/* Container for the articles */}
			<div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
				{newsArticles.length > 0 ? (
					newsArticles.map((article: NewsArticle) => (
						<NewsArticleCard key={article.id} article={article} isSummary={true} />
					))
				) : (
					// Fallback message if no articles are loaded
					<div className="text-center py-16 bg-white border border-slate-200 rounded-lg shadow-sm">
						<p className="text-xl text-slate-600">No news articles available yet. Check back soon!</p>
					</div>
				)}
			</div>
		</div>
	)
}
