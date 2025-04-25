import React from 'react';

interface ConfirmationStatusIconProps {
    isSuccess: boolean | null;
    orderError: string | null; // Check if there's a specific error
    isLoading: boolean; // Need loading state to show spinner
}

export const ConfirmationStatusIcon: React.FC<ConfirmationStatusIconProps> = ({ isSuccess, orderError, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-16 h-16 mx-auto mb-4">
                 <div className="spinner border-t-4 border-purple-500 border-solid rounded-full w-16 h-16 animate-spin"></div>
            </div>
        );
    }

    if (orderError || isSuccess === false) {
         return (
             <span className="material-symbols-outlined text-7xl text-red-500 mb-4 block mx-auto">
                 error
             </span>
         );
    }

    if (isSuccess === true) {
         return (
             <span className="material-symbols-outlined text-7xl text-emerald-500 mb-4 block mx-auto">
                 check_circle
             </span>
         );
    }
    
    // Return null or a placeholder if status is indeterminate (e.g., isSuccess === null and not loading/error)
    return null; 
}; 