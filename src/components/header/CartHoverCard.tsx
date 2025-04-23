import React from 'react';
import { Link } from 'react-router-dom';
import { CartItem } from '../../context/CartContext';

interface CartHoverCardProps {
    items: CartItem[];
    total: number;
    itemCount: number;
}

// Maximum number of items to show in the preview
const MAX_PREVIEW_ITEMS = 3;

export const CartHoverCard: React.FC<CartHoverCardProps> = ({ items, total, itemCount }) => {

    if (itemCount === 0) {
        return (
            <div className="absolute top-full right-0 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-4 text-center">
                <p className="text-sm text-slate-500">Your cart is empty.</p>
            </div>
        );
    }

    const itemsToShow = items.slice(0, MAX_PREVIEW_ITEMS);
    const remainingItems = itemCount - itemsToShow.reduce((sum, item) => sum + item.quantity, 0); // Calculate remaining count based on quantities shown

    return (
        <div className="absolute top-full right-0 w-72 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                {itemsToShow.map(item => (
                    <div key={item.id} className="flex items-center space-x-3 text-sm">
                        <img 
                            src={item.imageSrc || '/images/blue-soon.png'} 
                            alt={item.name} 
                            className="w-10 h-10 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-grow overflow-hidden">
                            <p className="text-slate-800 font-medium truncate" title={item.name}>{item.name}</p>
                            <p className="text-slate-500">Qty: {item.quantity} - ${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                    </div>
                ))}
                {remainingItems > 0 && (
                    <p className="text-xs text-slate-500 text-center pt-2">+ {remainingItems} more item(s)...</p>
                )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 space-y-2">
                 <div className="flex justify-between text-sm font-semibold text-slate-700">
                    <span>Subtotal:</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                 <Link 
                    to="/cart"
                    className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200 ease-in-out"
                 >
                    View Cart & Checkout
                 </Link>
            </div>
        </div>
    );
}; 