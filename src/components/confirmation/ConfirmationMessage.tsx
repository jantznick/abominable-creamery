import React from 'react';

interface ConfirmationMessageProps {
    isSuccess: boolean | null;
    message: string | null;
    orderError: string | null;
}

export const ConfirmationMessage: React.FC<ConfirmationMessageProps> = ({ isSuccess, message, orderError }) => {
    // Use orderError first if it exists, otherwise use the general message
    const displayMessage = orderError || message || (isSuccess === false ? 'An unknown error occurred.' : 'Processing...');
    const messageColor = orderError || isSuccess === false ? 'text-red-700' : 'text-slate-800';

    return (
        <p className={`text-xl md:text-2xl font-semibold my-6 ${messageColor}`}>
            {displayMessage}
        </p>
    );
}; 