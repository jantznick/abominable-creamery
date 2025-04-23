import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import { NewsArticle, ContentBlock } from '../../utils/content'; // Import the interface

interface NewsArticleCardProps {
    article: NewsArticle;
    isSummary?: boolean; // Optional prop to indicate summary view
}

export const NewsArticleCard: React.FC<NewsArticleCardProps> = ({ article, isSummary = false }) => {
    return (
        <article className="bg-white p-6 md:p-8 rounded-lg shadow-md border border-slate-200">
            {/* Make title a link in summary view */}
            {isSummary ? (
                <Link to={`/news/${article.slug}`} className="hover:text-indigo-600 transition-colors duration-200">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600">{article.title}</h2>
                </Link>
            ) : (
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{article.title}</h2>
            )}
            <p className="text-sm text-slate-500 mb-6">{article.date}</p>
            
            {/* Apply prose for basic content styling */}
            <div className="prose prose-slate max-w-none prose-p:my-3 prose-li:my-1.5">
                {/* Render full content or just summary */}
                {isSummary ? (
                    <>
                        <p>{article.summary}</p> 
                        <Link 
                            to={`/news/${article.slug}`} 
                            className="text-indigo-600 hover:text-indigo-800 font-semibold no-underline hover:underline mt-4 inline-block"
                        >
                            Read More &rarr;
                        </Link>
                    </>
                ) : (
                    article.content.map((block: ContentBlock, index: number) => {
                        if (block.type === 'paragraph') {
                            return <p key={index}>{block.text}</p>;
                        } else if (block.type === 'list') {
                            return (
                                <ol key={index} className="list-decimal pl-6 space-y-2">
                                    {block.items.map((item: string, itemIndex: number) => (
                                        // Use dangerouslySetInnerHTML for the embedded <strong> tags
                                        // Be cautious with this if content comes from untrusted sources
                                        <li key={itemIndex} dangerouslySetInnerHTML={{ __html: item }}></li>
                                    ))}
                                </ol>
                            );
                        }
                        return null;
                    })
                )}
            </div>
        </article>
    );
}; 