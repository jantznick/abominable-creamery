import React from 'react';
import { OrderData, OrderItemData } from '../../types/data'; // Import necessary types

interface OrderSummaryDisplayProps {
    orderDetails: OrderData | null;
}

// Helper to format currency (consider moving to a shared util if used elsewhere)
const formatCurrency = (amount: number | string): string => {
    const numberAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numberAmount)) {
        return '$--.--'; // Fallback for invalid numbers
    }
    return `$${numberAmount.toFixed(2)}`;
};

export const OrderSummaryDisplay: React.FC<OrderSummaryDisplayProps> = ({ orderDetails }) => {
    if (!orderDetails) {
        return null; // Don't render anything if no details are available
    }

    return (
        <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-lg my-8 text-sm">
            <h3 className="text-lg font-bold mb-5 text-purple-700 text-center border-b border-purple-100 pb-3">
                 <span className="material-symbols-outlined align-middle mr-1 text-purple-600">receipt_long</span>
                 Order Summary
            </h3>
            <ul className="space-y-3 mb-4">
                {orderDetails.items.map((item: OrderItemData, index) => {
                    // Use fetched imageUrl, fallback to placeholder if missing
                    const imageUrlToDisplay = (item as any).imageUrl || '/images/placeholder.png'; // Use type assertion as OrderItemData might not have imageUrl yet
                    
                    return (
                        <li key={`${item.productId}-${index}`} className="flex items-center space-x-3 text-slate-700">
                             {/* Product Image */}
                             <img 
                                src={imageUrlToDisplay}
                                alt={item.productName}
                                className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-slate-100 shadow-sm bg-slate-50"
                                onError={(e) => { 
                                    (e.target as HTMLImageElement).src = '/images/placeholder.png'; 
                                    (e.target as HTMLImageElement).onerror = null; 
                                }} 
                             />
                             {/* Item Details */}
                            <div className="flex-grow flex justify-between items-center">
                                <div className="flex-1 mr-2">
                                    <span className="font-medium text-slate-800 block">{item.productName}</span> 
                                    <span className="text-slate-500 text-xs">Qty: {item.quantity}</span>
                                </div>
                                <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(item.price)}</span>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="border-t-2 border-dashed border-purple-100 pt-4 mt-4 font-bold flex justify-between text-lg text-slate-900">
                <span>Total:</span> 
                <span className="text-purple-700">{formatCurrency(orderDetails.totalAmount)}</span>
            </div>
        </div>
    );
}; 