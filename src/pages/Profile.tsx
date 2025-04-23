import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageTitle } from '../components/common/PageTitle';
// Import shared types
import { OrderData, ApiUser } from '../types/data'; 
// Import the new view components
import { UserProfileView } from '../components/profile/UserProfileView';
import { AdminOrdersView } from '../components/profile/AdminOrdersView';

// NOTE: The interfaces ApiUser, OrderItemData, OrderData were moved to ../types/data.ts

const Profile: React.FC = () => {
    // Keep state and data fetching logic in the main page component
    const { user, isLoading: isAuthLoading } = useAuth();
    // Rename state for clarity
    const [fetchedOrders, setFetchedOrders] = useState<OrderData[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [errorLoadingOrders, setErrorLoadingOrders] = useState<string | null>(null);

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
            {/* Pass user type assertion as ApiUser | null | undefined might not be specific enough for child */}
            <PageTitle title={isAdmin ? 'Admin Dashboard' : 'Your Profile'} />
            
            {/* Conditionally render the appropriate view component */}
            {isAdmin ? (
                <AdminOrdersView 
                    // Pass the logged-in admin user object
                    user={user as ApiUser} 
                    // Pass all fetched orders (which will be from /all)
                    allOrders={fetchedOrders} 
                    isLoadingOrders={isLoadingOrders} 
                    errorLoadingOrders={errorLoadingOrders} 
                    formatDate={formatDate} 
                    formatCurrency={formatCurrency} 
                    // Pass the handler down
                    onOrderStatusUpdate={handleOrderStatusUpdate} 
                />
            ) : (
                <UserProfileView 
                    user={user as ApiUser} 
                    // Pass fetched orders (which will be from /my)
                    orders={fetchedOrders} 
                    isLoadingOrders={isLoadingOrders} 
                    errorLoadingOrders={errorLoadingOrders} 
                    formatDate={formatDate} 
                    formatCurrency={formatCurrency} 
                />
            )}
        </div>
    );
};

export default Profile; 