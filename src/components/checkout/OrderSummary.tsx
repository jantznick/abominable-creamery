import React from 'react';
import { CartItem } from '../../context/CartContext'; // Adjust path as needed

interface OrderSummaryProps {
    items: CartItem[];
    subtotal: number;
    shippingCost: number;
    total: number;
    isLoadingShippingRate: boolean;
    errorLoadingShippingRate: string | null;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
    items,
    subtotal,
    shippingCost,
    total,
    isLoadingShippingRate,
    errorLoadingShippingRate
}) => {
    return (
        <div className="bg-slate-50 p-6 rounded-lg shadow-md sticky top-24">
            <h2 className="text-xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">Order Summary</h2>

            {/* Cart Items Mini View */}
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
                {items.map((item) => {
                    const itemPrice = parseFloat(item.price);
                    const itemTotal = !isNaN(itemPrice) ? (itemPrice * item.quantity).toFixed(2) : 'Invalid';
                    return (
                        <div key={`${item.productId}-${item.priceId}`} className="flex justify-between items-center text-sm">
                            <span className="flex-1 mr-2">{item.name} ({item.quantity})</span>
                            <span className="text-slate-700 font-medium">${itemTotal}</span>
                        </div>
                    );
                })}
                {items.length === 0 && <p className="text-slate-500 text-sm text-center">(Your cart is empty)</p>}
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-2 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                    <span>Shipping</span>
                    {/* Show loading indicator or error for shipping */}
                    {isLoadingShippingRate ? (
                        <span className="italic text-slate-400">Loading...</span>
                    ) : errorLoadingShippingRate ? (
                        <span className="text-red-500 text-xs">Error</span> // Or display fallback price
                    ) : (
                        <span>${shippingCost.toFixed(2)}</span>
                    )}
                </div>
                {/* Tax Row Removed */}
                <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-300 pt-3 mt-3">
                    <span>Total</span>
                    {/* Show loading for total as well */}
                    {isLoadingShippingRate ? (
                        <span className="italic text-slate-400">Calculating...</span>
                    ) : (
                        <span>${total.toFixed(2)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}; 