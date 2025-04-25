import React, { useState } from 'react';
// Import shared types from the new types file
import { OrderData, ApiUser, OrderItemData } from '../../types/data'; 
import { OrderCard } from '../orders/OrderCard'; // Import the new component
import UserProfileModal from './UserProfileModal'; // Import profile modal
import { formatPhoneNumber } from '../../utils/formatting'; // Import the new formatter
import SubscriptionList from './SubscriptionList'; // Import SubscriptionList

// Define props required by this component
interface UserProfileViewProps {
    user: ApiUser; // User details are needed
    orders: OrderData[] | undefined; // Allow undefined
    isLoadingOrders: boolean;
    errorLoadingOrders: string | null;
    formatDate: (dateString: string) => string; // Pass helper functions as props
    formatCurrency: (amount: number | string) => string;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
    user,
    orders,
    isLoadingOrders,
    errorLoadingOrders,
    formatDate,
    formatCurrency
}) => {
    const ordersToDisplay = orders || []; // Ensure it's an array
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    return (
        <div>
            <h2 className="text-xl font-semibold mb-6 border-b pb-3">Welcome, {user.name || user.email}!</h2>
            
            <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Account Details</h3>
                    <button 
                        onClick={() => setIsProfileModalOpen(true)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                    >
                        Edit Profile
                    </button>
                </div>
                <p className="text-slate-700"><span className="font-medium text-slate-800">Email:</span> {user.email}</p>
                <p className="text-slate-700"><span className="font-medium text-slate-800">Name:</span> {user.name || <span className="italic text-slate-500">Not Set</span>}</p>
                <p className="text-slate-700">
                    <span className="font-medium text-slate-800">Phone:</span> 
                    {user.phone ? formatPhoneNumber(user.phone) : <span className="italic text-slate-500">Not Provided</span>}
                </p>
                {/* Display Role if needed */}
                {/* <p className="text-slate-700"><span className="font-medium text-slate-800">Role:</span> {user.role}</p> */}
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Your Order History</h3>
                {isLoadingOrders ? (
                    <p className="text-slate-500"><div className="spinner border-t-2 border-indigo-500 border-solid rounded-full w-4 h-4 animate-spin inline-block mr-2"></div>Loading orders...</p>
                ) : errorLoadingOrders ? (
                    <p className="text-red-600 bg-red-50 p-3 rounded"><span className="font-bold">Error:</span> {errorLoadingOrders}</p>
                ) : ordersToDisplay.length === 0 ? (
                    <p className="text-slate-500 bg-slate-50 p-4 rounded"><span className="italic">You haven't placed any orders yet.</span></p>
                ) : (
                    <div className="space-y-4"> {/* Adjusted spacing */}
                         {/* Use the OrderCard component */}
                        {ordersToDisplay.map((order) => (
                            <OrderCard 
                                key={order.id} 
                                order={order} 
                                // isAdminView={false} // Default is false, so not strictly needed
                                formatDate={formatDate} 
                                formatCurrency={formatCurrency} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* --- Subscription Management Section --- */}
            {/* Render this section regardless of orders */}
            <SubscriptionList />
            {/* ------------------------------------ */}	

            {/* Profile Edit Modal */}
            {user && ( // Ensure user data is available before rendering modal
                <UserProfileModal 
                    isOpen={isProfileModalOpen} 
                    onClose={() => setIsProfileModalOpen(false)} 
                    currentUser={user} 
                />
            )}
        </div>
    );
}; 