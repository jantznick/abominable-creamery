import React from 'react';

interface SectionHeaderProps {
    title: string;
    isComplete: boolean;
    isActive: boolean; // Is this the currently active section?
    onEdit?: () => void; // Optional edit handler
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, isComplete, isActive, onEdit }) => {
    return (
        <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${isComplete && !isActive ? 'text-slate-600' : 'text-slate-800'}`}>
                {title}
            </h2>
            {isComplete && !isActive && onEdit && (
                <button
                    onClick={onEdit}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    Edit
                </button>
            )}
        </div>
    );
}; 