import React, { useState } from 'react';
import classNames from 'classnames';
import { OrderData, OrderItemData } from '../../types/data';

// Define props required by this component
interface OrderCardProps {
    order: OrderData;
    isAdminView?: boolean; // Optional flag for admin-specific details
    formatDate: (dateString: string) => string;
    formatCurrency: (amount: number | string) => string;
    onOrderStatusUpdate?: (orderId: number, newStatus: string) => void;
    activeAdminTab?: 'my' | 'all'; // Add prop for active tab in admin view
}

export const OrderCard: React.FC<OrderCardProps> = ({
    order,
    isAdminView = false,
    formatDate,
    formatCurrency,
    onOrderStatusUpdate,
    activeAdminTab
}) => {
    const [isOpen, setIsOpen] = useState(false); // State for collapsible section
    const [isUpdating, setIsUpdating] = useState(false); // State for button loading
    const [updateError, setUpdateError] = useState<string | null>(null); // State for error message

    // Helper to render a single order item
    const renderOrderItem = (item: OrderItemData) => {
        // Construct the assumed image path
        // TODO: Ideally, this URL should come from the backend via item.imageUrl
        const assumedImageUrl = `/images/flavors/${item.productId}.png`;

        return (
            <li key={item.id} className="flex items-center text-sm py-2">
                {/* Image */}
                <img 
                    src={item.imageUrl || assumedImageUrl} // Use provided URL or fallback to assumption
                    alt={item.productName}
                    className="w-12 h-12 object-cover rounded-md mr-3 flex-shrink-0 bg-slate-100" // Added bg for loading/error state
                    onError={(e) => { 
                        // Fallback if the assumed image doesn't load
                        (e.target as HTMLImageElement).src = '/images/placeholder.png'; 
                        (e.target as HTMLImageElement).onerror = null; // Prevent infinite loop
                    }} 
                />
                {/* Details */}
                <div className="flex-grow flex justify-between items-center">
                    <div>
                        <span className="font-medium text-slate-800 block">{item.productName}</span>
                        <span className="text-xs text-slate-500 block">ID: {item.productId}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-slate-700 block">Qty: {item.quantity}</span>
                        <span className="text-slate-600 text-xs block">@ {formatCurrency(item.price)}</span>
                    </div>
                </div>
            </li>
        );
    };

    // Handler for the "Mark as Shipped" button
    const handleMarkAsShipped = async () => {
        if (!onOrderStatusUpdate || isUpdating || order.status === 'SHIPPED' || activeAdminTab !== 'all') {
            return;
        }

        setIsUpdating(true);
        setUpdateError(null);
        const newStatus = 'SHIPPED';

        try {
            const response = await fetch(`/api/orders/${order.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to update status: ${response.status}`);
            }

            // Call the callback passed from the parent to update the state there
            onOrderStatusUpdate(order.id, newStatus);

        } catch (err: any) {
            console.error("Error updating order status:", err);
            setUpdateError(err.message || "Could not update order status.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {/* Clickable Header */}
            <div 
                className="px-4 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={`order-details-${order.id}`}
            >
                {/* Order ID and Status */}
                <div className="flex-1 min-w-0 flex items-center">
                     <span 
                        className={classNames(
                            'material-symbols-outlined text-lg mr-2 text-slate-500 transition-transform duration-200',
                            { 'rotate-90': isOpen }
                        )}
                    >
                        chevron_right 
                    </span>
                    <span className="text-sm font-medium text-slate-800 mr-2">Order #{order.id}</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        order.status === 'PAID' ? 'bg-green-100 text-green-800' 
                        : order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' 
                        : 'bg-yellow-100 text-yellow-800' // Default for PENDING/PROCESSING etc.
                    }`}>
                        {order.status}
                    </span>
                </div>

                {/* User/Guest Info (Shown in Admin view or if user is logged in) */}
                {isAdminView && (
                    <div className="text-sm text-slate-600">
                        {order.user ? (
                            <span>User: {order.user.name || order.user.email} (ID: {order.user.id})</span>
                        ) : (
                            <span className="italic">Guest ({order.contactEmail || 'N/A'})</span>
                        )}
                    </div>
                )}

                {/* Date and Total */}
                <div className="text-sm text-slate-600"><span className="font-medium hidden sm:inline">Placed:</span> {formatDate(order.createdAt)}</div>
                <div className="text-sm text-slate-800 font-semibold"><span className="font-medium text-slate-600 hidden sm:inline">Total:</span> {formatCurrency(order.totalAmount)}</div>
            </div>
            
            {/* Collapsible Details Section */}
            <div 
                id={`order-details-${order.id}`}
                className={classNames(
                    'transition-all duration-300 ease-in-out overflow-hidden',
                    { 'max-h-screen opacity-100': isOpen, 'max-h-0 opacity-0': !isOpen }
                )}
            >
                {isOpen && ( // Only render content when open for performance
                    <div className="p-4 space-y-4">
                        {/* Shipping Details */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Shipping To:</h4>
                            <p className="text-sm text-slate-600">{order.shippingName || 'N/A'}</p>
                            {/* Placeholder for more address details */}
                            <p className="text-sm text-slate-500 italic mt-1">
                                {order.shippingAddress1 ? `${order.shippingAddress1}, ` : ''} 
                                {order.shippingAddress2 ? `${order.shippingAddress2}, ` : ''} 
                                {order.shippingCity ? `${order.shippingCity}, ` : ''}{order.shippingState ? `${order.shippingState} ` : ''}
                                {order.shippingZip ? `${order.shippingZip}` : ''}
                                {!order.shippingAddress1 && !order.shippingCity && '(Address details not available)'}
                            </p>
                             <p className="text-sm text-slate-600 mt-1"><span className="font-medium">Contact:</span> {order.contactEmail || 'N/A'}</p>
                        </div>

                        {/* Order Items */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Items:</h4>
                            <ul className="space-y-1 divide-y divide-slate-100">
                                {order.items.length > 0 
                                    ? order.items.map(renderOrderItem)
                                    : <li className="text-sm text-slate-500 italic">No items found for this order.</li>
                                }
                            </ul>
                        </div>

                         {/* Admin Actions - Conditionally rendered based on view AND tab */}
                        {isAdminView && activeAdminTab === 'all' && (
                            <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">Admin Actions:</h4>
                                <button
                                    onClick={handleMarkAsShipped}
                                    disabled={isUpdating || order.status === 'SHIPPED'}
                                    className={classNames(
                                        "text-xs px-2 py-1 rounded transition-colors duration-150",
                                        "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400",
                                        {
                                            'bg-blue-100 text-blue-700 hover:bg-blue-200': !isUpdating && order.status !== 'SHIPPED',
                                            'bg-slate-200 text-slate-500 cursor-not-allowed': isUpdating || order.status === 'SHIPPED',
                                            'opacity-75 cursor-wait': isUpdating,
                                        }
                                    )}
                                >
                                    {isUpdating ? 'Updating...' : order.status === 'SHIPPED' ? 'Shipped' : 'Mark as Shipped'}
                                </button>
                                {updateError && (
                                    <p className="text-xs text-red-600 mt-1">{updateError}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}; 