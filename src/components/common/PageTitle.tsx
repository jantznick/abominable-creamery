import React from 'react';

interface PageTitleProps {
    title: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ title }) => {
    return (
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 md:mb-10 text-center">
            {title}
        </h1>
    );
}; 