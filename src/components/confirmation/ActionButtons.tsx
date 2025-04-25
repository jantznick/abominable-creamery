import React from 'react';
import { Link } from 'react-router-dom';

interface ActionButtonsProps {
    isSuccess: boolean | null;
    confirmationType: 'subscription' | 'order' | null;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ isSuccess, confirmationType }) => {
    return (
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4 mt-10">
            {/* Account/History Link - Conditionally rendered on success */}
            {isSuccess === true && confirmationType && (
                 <Link
                     to="/profile" 
                     // Slightly less prominent style for secondary action
                     className="w-full sm:w-auto text-center px-8 py-3 rounded-lg font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors duration-300 ease-in-out shadow-sm"
                 >
                     {confirmationType === 'subscription' ? 'View Subscriptions' : 'View Order History'}
                 </Link>
            )}
            {/* Continue Shopping Link - Always shown */}
            <Link
                to="/flavors"
                // More prominent style for primary action
                className="w-full sm:w-auto text-center px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 ease-in-out shadow hover:shadow-md"
            >
                Continue Shopping
            </Link>
        </div>
    );
}; 