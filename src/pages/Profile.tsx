import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageTitle } from '../components/common/PageTitle';
// Import shared types
import { OrderData, ApiUser } from '../types/data'; 
// Import the new view components
import { UserProfileView } from '../components/profile/UserProfileView';
import { AdminOrdersView } from '../components/profile/AdminOrdersView';
import AddressManager from '../components/profile/AddressManager';
import UserProfileModal from '../components/profile/UserProfileModal';
import CardManager from '../components/profile/CardManager';
import { formatPhoneNumber } from '../utils/formatting';

// NOTE: The interfaces ApiUser, OrderItemData, OrderData were moved to ../types/data.ts

const Profile: React.FC = () => {
    // Keep state and data fetching logic in the main page component
    const { user, isLoading: isAuthLoading } = useAuth();
    // Rename state for clarity
    const [fetchedOrders, setFetchedOrders] = useState<OrderData[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [errorLoadingOrders, setErrorLoadingOrders] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

    useEffect(() => {
        if (!isAuthLoading && user) {
            setIsLoadingOrders(true);
            setErrorLoadingOrders(null);
            const endpoint = isAdmin ? '/api/orders/all' : '/api/orders/my';
            console.log(`Profile: Fetching from ${endpoint} for user:`, user.id, `(Admin: ${isAdmin})`);

            fetch(endpoint)
                .then(async (res) => {
                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw new Error(errorData.message || `Failed to fetch orders: ${res.status}`);
                    }
                    return res.json();
                })
                .then((data: OrderData[]) => {
                    // Set the fetched orders (either /my or /all)
                    setFetchedOrders(data);
                })
                .catch(err => {
                    console.error("Profile: Error fetching orders:", err);
                    setErrorLoadingOrders(err.message || "Could not load order history.");
                })
                .finally(() => {
                    setIsLoadingOrders(false);
                });
        }
    }, [user, isAuthLoading, isAdmin]);

    // Keep helper functions here to pass down as props
    const formatDate = (dateString: string): string => {
        try {
            return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return dateString;
        }
    };

    const formatCurrency = (amount: number | string): string => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(num)) return 'N/A';
        return `$${num.toFixed(2)}`;
    };

    // Handler to update local state after status change via API
    const handleOrderStatusUpdate = (orderId: number, newStatus: string) => {
        setFetchedOrders(currentOrders => 
            currentOrders.map(order => 
                order.id === orderId ? { ...order, status: newStatus } : order
            )
        );
        // Optional: Show a success toast/message here
        console.log(`Order ${orderId} status updated locally to ${newStatus}`);
    };

    // Loading and Auth checks remain here
    if (isAuthLoading) {
        return <div className="container mx-auto px-4 py-8 text-center"><p>Loading profile...</p></div>;
    }
    if (!user) {
        // This case should be handled by ProtectedRoute, but acts as a fallback
        return <div className="container mx-auto px-4 py-8 text-center"><p>Please log in to view your profile.</p></div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <PageTitle title={isAdmin ? 'Admin Dashboard' : 'Your Profile'} />
            
            {isAdmin ? (
              <>
                <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
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
					<p className="text-slate-700"><span className="font-medium text-slate-800">Phone:</span> {formatPhoneNumber(user.phone) || <span className="italic text-slate-500">Not Provided</span>}</p>
                    {isAdmin && <p className="text-slate-700"><span className="font-medium text-slate-800">Role:</span> {user.role}</p>} 
                </div>

                <AdminOrdersView 
                    user={user as ApiUser} 
                    allOrders={fetchedOrders} 
                    isLoadingOrders={isLoadingOrders} 
                    errorLoadingOrders={errorLoadingOrders} 
                    formatDate={formatDate} 
                    formatCurrency={formatCurrency} 
                    onOrderStatusUpdate={handleOrderStatusUpdate} 
                />
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-semibold mb-4">Your Saved Addresses</h3>
                  <AddressManager />
                </div>

                <UserProfileModal 
                    isOpen={isProfileModalOpen} 
                    onClose={() => setIsProfileModalOpen(false)} 
                    currentUser={user as ApiUser}
                />
              </>
            ) : (
                <>
                    <UserProfileView 
                        user={user as ApiUser} 
                        orders={fetchedOrders} 
                        isLoadingOrders={isLoadingOrders} 
                        errorLoadingOrders={errorLoadingOrders} 
                        formatDate={formatDate} 
                        formatCurrency={formatCurrency} 
                    />
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <AddressManager />
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <CardManager />
                    </div>
                </>
            )}
        </div>
    );
};

export default Profile; 