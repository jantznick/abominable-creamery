import React from 'react'
import { Link } from 'react-router-dom'
import { useCart, CartItem } from '../context/CartContext'; // Import useCart and CartItem type

// Interface for props of CartItemRow
interface CartItemRowProps {
	item: CartItem;
}

// Reusable component for a single cart item row
const CartItemRow: React.FC<CartItemRowProps> = ({ item }) => {
	const { updateQuantity, removeItem } = useCart(); // Get context functions here

	const handleQuantity = (amount: number) => {
		// Update quantity using context function, ensure quantity >= 1
		const newQuantity = Math.max(1, item.quantity + amount);
		// Use priceId now for updating
		updateQuantity(item.priceId, newQuantity); 
	};

	const handleRemove = () => {
		// Use priceId now for removing
		removeItem(item.priceId); 
	};

	// Default image logic (can be refined)
	const imageToDisplay = item.imageSrc || `/images/blue-soon.png`;

	// Parse price string for calculations
	const priceAsNumber = parseFloat(item.price);
	const isValidPrice = !isNaN(priceAsNumber);
	const itemTotal = isValidPrice ? (priceAsNumber * item.quantity).toFixed(2) : 'Invalid Price';

	return (
		<div className="flex items-center justify-between py-4 border-b border-slate-200 flex-wrap md:flex-nowrap last:border-b-0">
			<div className="flex items-center space-x-4 w-full md:w-1/2 mb-4 md:mb-0">
				<img src={imageToDisplay} alt={item.name} className="w-16 h-16 object-cover rounded-md shadow-sm" />
				<div>
					{/* Link to the main product/flavor page using productId */}
					{/* TODO: Need slug here! CartItem currently only has productId. */}
					{/* Need to either: 
						 1. Add slug to CartItem (requires updating CartContext, additem call in Flavor.tsx) 
						 2. Or, look up the slug using productId from the main product context. (More complex in CartItemRow) 
						 Option 1 is cleaner if slug is needed often for cart items. 
						 Let's assume we'll add slug to CartItem later. For now, link still uses productId. */}
					<Link 
						// Use slug for linking now that it's in CartItem
						to={item.slug ? `/flavors/${item.slug}` : '/flavors'} 
						className="font-semibold text-lg text-slate-800 hover:text-indigo-600 transition-colors duration-200"
					 >
					 {item.name}
					</Link>
					{/* Subscription Details (Conditional) */}
					{item.isSubscription && (
						<span className="block text-xs text-indigo-600 font-medium ml-1">
							(Subscription{item.recurringInterval ? ` / ${item.recurringInterval}` : ''})
						</span>
					)}
					{/* Display price per unit */}
					<p className="text-sm text-slate-500 mt-0.5">${item.price} each</p> 
					<button onClick={handleRemove} className="text-xs text-red-500 hover:text-red-700 mt-1 transition-colors duration-200">Remove</button>
				</div>
			</div>
			<div className="flex items-center justify-between w-full md:w-auto md:ml-auto">
				{/* Quantity Selector */}
				<div className="flex items-center border border-slate-300 rounded-md overflow-hidden shadow-sm">
					<button onClick={() => handleQuantity(-1)} className="px-3 py-1 text-slate-600 hover:bg-slate-100 transition-colors duration-200">-</button>
					<input type="number" value={item.quantity} readOnly className="w-12 text-center border-l border-r border-slate-300 py-1 focus:outline-none" />
					<button onClick={() => handleQuantity(1)} className="px-3 py-1 text-slate-600 hover:bg-slate-100 transition-colors duration-200">+</button>
				</div>
				{/* Item Total - Use calculated total */}
				<p className="font-semibold text-lg text-slate-800 ml-6 w-24 text-right">
					${itemTotal}
				</p>
			</div>
		</div>
	);
};

export const Cart = () => {
	// Use the Cart context
	const { items, getCartTotal, clearCart } = useCart();

	const subtotal = getCartTotal();
	// const estimatedShipping = 5.00; // Keep placeholder or implement logic later
	// const total = subtotal + estimatedShipping;
	const total = subtotal; // For now, total is just subtotal

	return (
		<div className='grow container mx-auto px-4 py-8 md:py-16'>
			<h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center md:text-left">Shopping Cart</h1>

			{items.length === 0 ? (
				<div className="text-center py-16 bg-white border border-slate-200 rounded-lg shadow-sm">
					<span className="material-symbols-outlined text-6xl text-slate-400 mb-4">shopping_cart_off</span>
					<p className="text-xl text-slate-600 mb-6">Your cart is currently empty.</p>
					<Link
						to="/flavors"
						className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 ease-in-out"
					>
						Explore Flavors
					</Link>
				</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
					{/* Cart Items List */}
					<div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-slate-200">
						{items.map(item => (
							<CartItemRow
								// Use priceId for the key now
								key={item.priceId} 
								item={item}
							/>
						))}
                        {/* Clear Cart Button */}
                        <div className="text-right mt-6">
                            <button
                                onClick={clearCart}
                                className="text-sm text-slate-500 hover:text-red-600 hover:underline transition-colors duration-200"
                            >
                                Clear Cart
                            </button>
                        </div>
					</div>

					{/* Order Summary */}
					<div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md sticky top-24 border border-slate-200">
						<h2 className="text-2xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">Order Summary</h2>
						<div className="space-y-3 text-lg text-slate-700">
							<div className="flex justify-between">
								<span>Subtotal</span>
								<span>${subtotal.toFixed(2)}</span>
							</div>
							{/* <div className="flex justify-between">
								<span>Estimated Shipping</span>
								<span>${estimatedShipping.toFixed(2)}</span>
							</div> */}
							<div className="flex justify-between font-bold text-xl pt-3 border-t border-slate-300 mt-3">
								<span>Total</span>
								<span>${total.toFixed(2)}</span>
							</div>
						</div>
						<Link 
							to="/checkout"
							className="block w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white text-center font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out"
						>
							Proceed to Checkout
						</Link>
					</div>
				</div>
			)}
		</div>
	)
}

