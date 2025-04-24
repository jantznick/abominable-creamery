import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Subscription } from '@prisma/client'; // Import Prisma Subscription type

// Helper to format date
const formatDate = (dateString: string | Date): string => {
    try {
        // Ensure the input is a valid date object or string parseable by Date constructor
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        // Check if the date is valid after parsing/creation
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", e);
        return 'Invalid Date';
    }
};

// Define a more specific type for the fetched data if needed,
// especially if you join product data later
interface DisplaySubscription extends Subscription {
    // productName?: string; // Example if joining product data
    // productImage?: string;
}

const SubscriptionList: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<DisplaySubscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Add state for cancellation
    const [isCancelling, setIsCancelling] = useState<string | null>(null); 
    const [cancelError, setCancelError] = useState<string | null>(null); // Specific error for cancellation

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetch('/api/subscriptions')
            .then(async (res) => {
                if (!res.ok) {
                    if (res.status === 401) {
                        throw new Error('Please log in to view subscriptions.');
                    }
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.message || `Failed to load subscriptions: ${res.status}`);
                }
                return res.json();
            })
            .then((data: DisplaySubscription[]) => {
                setSubscriptions(data);
            })
            .catch(err => {
                console.error("Error fetching subscriptions:", err);
                setError(err.message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    // --- Implement handleCancel function --- 
    const handleCancel = async (stripeSubId: string) => {
        if (isCancelling) return; // Prevent double clicks

        setIsCancelling(stripeSubId);
        setCancelError(null); // Clear previous cancel errors
        setError(null); // Clear general fetch errors

        try {
            const res = await fetch(`/api/subscriptions/${stripeSubId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' } // Required even if body is empty
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || `Failed to cancel subscription: ${res.status}`);
            }

            // Update local state on success
            setSubscriptions(currentSubs =>
                currentSubs.map(sub =>
                    sub.stripeSubscriptionId === stripeSubId
                        ? { ...sub, cancelAtPeriodEnd: true, status: data.subscription?.status || sub.status } // Use updated data from response
                        : sub
                )
            );
            console.log(`Subscription ${stripeSubId} successfully set to cancel at period end.`);
            // Optionally show a success message

        } catch (err: any) {
            console.error(`Error cancelling subscription ${stripeSubId}:`, err);
            setCancelError(err.message || 'An unknown error occurred during cancellation.');
        } finally {
            setIsCancelling(null); // Reset cancelling state regardless of outcome
        }
    };
    // -----------------------------------------

    const renderContent = () => {
        if (isLoading) {
            return <p className="text-slate-500 animate-pulse">Loading subscriptions...</p>;
        }
        if (error) {
            // Special handling for auth error
            if (error.includes('Please log in')) {
                return <p className="text-orange-600">{error}</p>; // Or trigger login modal
            }
            return <p className="text-red-600">Error: {error}</p>;
        }

        // Display cancellation error prominently if it exists
        if (cancelError) {
            return (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-red-700 font-semibold">Cancellation Error:</p>
                    <p className="text-red-600 text-sm">{cancelError}</p>
                    {/* Optionally add a retry button or link to support */} 
                </div>
            );
        }

        if (subscriptions.length === 0) {
            return <p className="text-slate-500">You have no active subscriptions.</p>;
        }

        return (
            <ul className="space-y-4">
                {subscriptions.map(sub => (
                    <li key={sub.id} className="p-4 border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col sm:flex-row justify-between items-start gap-4">
                        {/* Subscription Details */}
                        <div className="flex-grow">
                            {/* TODO: Display Product Name - Requires linking Product in Prisma schema or fetching details */} 
                            {/* For now, using Price ID as placeholder */}
                            <p className="text-lg font-semibold text-slate-800">Item: {sub.stripePriceId || 'Unknown Item'}</p>
                            <p className="text-sm text-slate-600 capitalize">
                                Status: <span className={`font-medium 
                                    ${sub.status === 'active' ? 'text-green-600' : 
                                      sub.status === 'trialing' ? 'text-blue-600' : 
                                      sub.status === 'past_due' ? 'text-red-600' : 
                                      sub.status === 'canceled' ? 'text-slate-500' : 
                                      'text-orange-600'}`}>
                                    {sub.status.replace('_', ' ')}
                                </span>
                            </p>
                             <p className="text-sm text-slate-500">
                                Interval: <span className="font-medium text-slate-700 capitalize">{sub.interval || 'N/A'}</span>
                             </p>
                            {sub.cancelAtPeriodEnd && (
                                 <p className="text-sm text-red-600 font-medium">Cancels on: {formatDate(sub.currentPeriodEnd)}</p>
                            )} 
                            {!sub.cancelAtPeriodEnd && sub.status !== 'canceled' && sub.currentPeriodEnd && (
                                <p className="text-sm text-slate-500">Next Renewal: {formatDate(sub.currentPeriodEnd)}</p>
                            )} 
                             <p className="text-xs text-slate-400 mt-1">Stripe ID: {sub.stripeSubscriptionId}</p>
                        </div>
                        
                        {/* Action Button Area */}
                        <div className="flex-shrink-0 mt-3 sm:mt-0 self-start sm:self-center">
                             {/* Show Cancel button only if active and not already set to cancel */} 
                            {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                                <button 
                                    onClick={() => handleCancel(sub.stripeSubscriptionId)} // Connect onClick
                                    disabled={isCancelling === sub.stripeSubscriptionId || !!isCancelling} // Disable if this OR any other is cancelling
                                    className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isCancelling === sub.stripeSubscriptionId ? 'Cancelling...' : 'Cancel'} {/* Update text */}
                                </button>
                            )}
                            {sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md">
                                    Cancels {formatDate(sub.currentPeriodEnd)}
                                </span>
                            )}
                            {sub.status === 'canceled' && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                                    Canceled
                                </span>
                            )}
                            {/* Add other statuses/actions as needed */}
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Your Subscriptions</h3>
            {/* Render cancellation error above the list if it occurs */}
            {cancelError && (
                 <div className="mb-4 bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-red-700 font-semibold">Cancellation Error:</p>
                    <p className="text-red-600 text-sm">{cancelError}</p>
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default SubscriptionList; 