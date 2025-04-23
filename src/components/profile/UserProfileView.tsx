import React from 'react';
// Import shared types from the new types file
import { OrderData, ApiUser, OrderItemData } from '../../types/data'; 
import { OrderCard } from '../orders/OrderCard'; // Import the new component

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

    return (
        <div>
            <h2 className="text-xl font-semibold mb-6 border-b pb-3">Welcome, {user.name || user.email}!</h2>
            
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">Account Details</h3>
                <p className="text-slate-700"><span className="font-medium text-slate-800">Email:</span> {user.email}</p>
                {/* Add other user details here if available/needed */}
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
        </div>
    );
}; 