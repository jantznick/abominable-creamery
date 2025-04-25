import React, { useState, useMemo } from 'react';
import classNames from 'classnames'; 
import { OrderData, ApiUser } from '../../types/data'; 
import { OrderCard } from '../orders/OrderCard'; 


interface AdminOrdersViewProps {
    user: ApiUser; 
    allOrders: OrderData[] | undefined; // Acknowledge it might be undefined initially
    isLoadingOrders: boolean;
    errorLoadingOrders: string | null;
    formatDate: (dateString: string) => string;
    formatCurrency: (amount: number | string) => string;
    onOrderStatusUpdate: (orderId: number, newStatus: string) => void;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({
    user,
    allOrders, // Can be undefined
    isLoadingOrders,
    errorLoadingOrders,
    formatDate,
    formatCurrency,
    onOrderStatusUpdate
}) => {
    const [activeTab, setActiveTab] = useState<'my' | 'all'>('all'); 

    const myOrders = useMemo(() => {
        // Ensure allOrders is treated as an array
        return (allOrders || []).filter(order => order.userId === user.id);
    }, [allOrders, user]);

    // Ensure ordersToDisplay is always an array
    const ordersToDisplay = activeTab === 'my' ? myOrders : (allOrders || []);

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-3">Admin Dashboard</h2>
            
            {/* Tab Navigation */}
            <div className="mb-6 border-b border-slate-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={classNames(
                            'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm',
                            activeTab === 'all' 
                                ? 'border-indigo-500 text-indigo-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        )}
                        disabled={isLoadingOrders} 
                    >
                        All Orders ({(allOrders || []).length}) 
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('my')}
                        className={classNames(
                            'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm',
                            activeTab === 'my' 
                                ? 'border-indigo-500 text-indigo-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        )}
                        disabled={isLoadingOrders}
                    >
                        My Orders ({myOrders.length})
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div>
                {isLoadingOrders ? (
                    <p className="text-slate-500"><div className="spinner border-t-2 border-indigo-500 border-solid rounded-full w-4 h-4 animate-spin inline-block mr-2"></div>Loading orders...</p>
                ) : errorLoadingOrders ? (
                    <p className="text-red-600 bg-red-50 p-3 rounded"><span className="font-bold">Error:</span> {errorLoadingOrders}</p>
                ) : ordersToDisplay.length === 0 ? ( 
                    <p className="text-slate-500 bg-slate-50 p-4 rounded">
                        <span className="italic">
                            {activeTab === 'my' ? 'You haven\'t placed any orders yourself.' : 'There are no orders yet.'}
                        </span>
                    </p>
                ) : (
                    <div className="space-y-4">
                        {ordersToDisplay.map((order) => (
                            <OrderCard 
                                key={order.id} 
                                order={order} 
                                isAdminView={true}
                                formatDate={formatDate} 
                                formatCurrency={formatCurrency} 
                                onOrderStatusUpdate={onOrderStatusUpdate} 
                                activeAdminTab={activeTab} 
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}; 