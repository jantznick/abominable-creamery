import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { newsArticles, NewsArticle } from '../utils/content';
import { NewsArticleCard } from '../components/news/NewsArticleCard';

export const NewsArticlePage = () => {
    const { slug } = useParams<{ slug: string }>();

    // Find the article by slug
    const article: NewsArticle | undefined = newsArticles.find(a => a.slug === slug);

    // Handle article not found
    if (!article) {
        return (
            <div className='grow flex flex-col items-center justify-center text-center p-8 bg-slate-50'>
                <span className="material-symbols-outlined text-6xl text-amber-500 mb-4">error</span>
                <h1 className="text-2xl md:text-4xl font-bold text-slate-700 mb-4">Oops! Article Not Found</h1>
                <p className="text-lg text-slate-500 mb-8">We couldn't find the news article you were looking for.</p>
                <Link to="/news" className='bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 ease-in-out'>
                    Back to News
                </Link>
            </div>
        );
    }

    return (
        <div className='grow container mx-auto px-4 py-8 md:py-16'>
            {/* Render the full article using the existing card component */}
            <div className="max-w-4xl mx-auto">
                <NewsArticleCard article={article} isSummary={false} />
                
                {/* Optional: Add a link back to the main news page */}
                <div className="mt-8 text-center md:text-left">
                    <Link to="/news" className='text-indigo-600 hover:text-indigo-800 font-semibold hover:underline'>
                        &larr; Back to All News
                    </Link>
                </div>
            </div>
        </div>
    );
}; 