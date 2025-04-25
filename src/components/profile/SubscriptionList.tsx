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
    productName?: string; // Add productName (optional)
    productImage?: string | null; // Add productImage (optional, can be null)
}

const SubscriptionList: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<DisplaySubscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Add state for cancellation
    const [isCancelling, setIsCancelling] = useState<string | null>(null); 
    const [cancelError, setCancelError] = useState<string | null>(null); // Specific error for cancellation

    // --- Action States --- 
    const [isPausing, setIsPausing] = useState<string | null>(null); // State for pause action
    const [isResuming, setIsResuming] = useState<string | null>(null); // State for resume action
    const [pauseResumeError, setPauseResumeError] = useState<string | null>(null); // Combined error for pause/resume

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

    // --- Pause Handler --- 
    const handlePause = async (stripeSubId: string) => {
        if (isPausing || isResuming || isCancelling) return; // Prevent concurrent actions

        setIsPausing(stripeSubId);
        setPauseResumeError(null); // Clear previous errors
        setCancelError(null);
        setError(null);

        try {
            const res = await fetch(`/api/subscriptions/${stripeSubId}/pause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `Failed to pause subscription: ${res.status}`);
            }
            // Update local state
            setSubscriptions(currentSubs =>
                currentSubs.map(sub =>
                    sub.stripeSubscriptionId === stripeSubId
                        ? { ...sub, collectionPaused: true } // Update paused flag
                        : sub
                )
            );
        } catch (err: any) {
            console.error(`Error pausing subscription ${stripeSubId}:`, err);
            setPauseResumeError(err.message || 'An unknown error occurred while pausing.');
        } finally {
            setIsPausing(null);
        }
    };

    // --- Resume Handler --- 
    const handleResume = async (stripeSubId: string) => {
        if (isPausing || isResuming || isCancelling) return; // Prevent concurrent actions

        setIsResuming(stripeSubId);
        setPauseResumeError(null); // Clear previous errors
        setCancelError(null);
        setError(null);

        try {
            const res = await fetch(`/api/subscriptions/${stripeSubId}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `Failed to resume subscription: ${res.status}`);
            }
            // Update local state
            setSubscriptions(currentSubs =>
                currentSubs.map(sub =>
                    sub.stripeSubscriptionId === stripeSubId
                        ? { ...sub, collectionPaused: false } // Update paused flag
                        : sub
                )
            );
        } catch (err: any) {
            console.error(`Error resuming subscription ${stripeSubId}:`, err);
            setPauseResumeError(err.message || 'An unknown error occurred while resuming.');
        } finally {
            setIsResuming(null);
        }
    };

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

        // Display pause/resume error OR cancellation error (prioritize showing one)
        const actionError = pauseResumeError || cancelError;
        if (actionError) {
            return (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-red-700 font-semibold">Action Error:</p>
                    <p className="text-red-600 text-sm">{actionError}</p>
                </div>
            );
        }

        if (subscriptions.length === 0) {
            return <p className="text-slate-500">You have no active subscriptions.</p>;
        }

        return (
            <ul className="space-y-4">
                {subscriptions.map(sub => {
                    // Determine if any action is currently processing for *this* subscription
                    const isProcessingThis = isCancelling === sub.stripeSubscriptionId || 
                                           isPausing === sub.stripeSubscriptionId || 
                                           isResuming === sub.stripeSubscriptionId;
                    // Determine if *any* action is processing (for disabling other buttons)
                    const isAnyProcessing = !!(isCancelling || isPausing || isResuming);
                    
                    return (
                        <li key={sub.id} className="p-4 border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col sm:flex-row justify-between items-start gap-4">
                            {/* Subscription Details - Now with Image and Name */}
                            <div className="flex items-start gap-4 flex-grow">
                                {/* Product Image */}
                                <div className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                                    {sub.productImage ? (
                                        <img 
                                            src={sub.productImage}
                                            alt={sub.productName || 'Subscription product image'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        // Placeholder Icon/Text
                                        <svg className="w-8 h-8 text-slate-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 18" />
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                        </svg>
                                    )}
                                </div>

                                {/* Product Name & Other Details */}
                                <div className="flex-grow">
                                    <p className="text-lg font-semibold text-slate-800">{sub.productName || sub.stripePriceId || 'Unknown Item'}</p> 
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-600 capitalize">
                                            Status: <span className={`font-medium 
                                                ${sub.status === 'active' && !sub.collectionPaused ? 'text-green-600' : 
                                                sub.status === 'active' && sub.collectionPaused ? 'text-yellow-600' : // Paused state
                                                sub.status === 'trialing' ? 'text-blue-600' : 
                                                sub.status === 'past_due' ? 'text-red-600' : 
                                                sub.status === 'canceled' ? 'text-slate-500' : 
                                                'text-orange-600'}`}>
                                                {sub.status.replace('_', ' ')}
                                            </span>
                                        </p>
                                        {/* Paused Badge */}
                                        {sub.collectionPaused && sub.status === 'active' && (
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                                Paused
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Interval: <span className="font-medium text-slate-700 capitalize">{sub.interval || 'N/A'}</span>
                                    </p>
                                    {sub.cancelAtPeriodEnd && (
                                        <p className="text-sm text-red-600 font-medium">Cancels on: {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'N/A'}</p>
                                    )} 
                                    {!sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                                        sub.currentPeriodEnd ? (
                                            <p className="text-sm text-slate-500">Next Renewal: {formatDate(sub.currentPeriodEnd)}</p>
                                        ) : null
                                    )} 
                                    <p className="text-xs text-slate-400 mt-1">Stripe ID: {sub.stripeSubscriptionId}</p>
                                </div>
                            </div>
                            
                            {/* Action Button Area - Add Pause/Resume */}
                            <div className="flex-shrink-0 mt-3 sm:mt-0 self-start sm:self-center flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                {/* Pause Button */}
                                {sub.status === 'active' && !sub.collectionPaused && !sub.cancelAtPeriodEnd && (
                                    <button 
                                        onClick={() => handlePause(sub.stripeSubscriptionId)}
                                        disabled={isProcessingThis || isAnyProcessing} 
                                        className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isPausing === sub.stripeSubscriptionId ? 'Pausing...' : 'Pause'}
                                    </button>
                                )}
                                {/* Resume Button */}
                                {sub.status === 'active' && sub.collectionPaused && (
                                     <button 
                                        onClick={() => handleResume(sub.stripeSubscriptionId)}
                                        disabled={isProcessingThis || isAnyProcessing} 
                                        className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isResuming === sub.stripeSubscriptionId ? 'Resuming...' : 'Resume'}
                                    </button>
                                )}
                                {/* Cancel Button */}
                                {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                                    <button 
                                        onClick={() => handleCancel(sub.stripeSubscriptionId)}
                                        disabled={isProcessingThis || isAnyProcessing}
                                        className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isCancelling === sub.stripeSubscriptionId ? 'Cancelling...' : 'Cancel'}
                                    </button>
                                )}
                                {/* Status Indicators (Cancel Pending / Canceled) */}
                                {sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md">
                                        Cancels {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'soon'}
                                    </span>
                                )}
                                {sub.status === 'canceled' && (
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                                        Canceled
                                    </span>
                                )}
                            </div>
                        </li>
                    )}
                )}
            </ul>
        );
    }

    return (
        <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Your Subscriptions</h3>
            {/* Render action error above the list if it occurs */}
            {(pauseResumeError || cancelError) && (
                 <div className="mb-4 bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-red-700 font-semibold">Action Error:</p>
                    <p className="text-red-600 text-sm">{pauseResumeError || cancelError}</p>
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default SubscriptionList; 