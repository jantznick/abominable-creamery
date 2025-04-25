import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext provides user info
import { ApiSavedCard } from '../../types/data'; // Assuming a type for saved card data exists
import ConfirmationModal from '../common/ConfirmationModal'; // Import ConfirmationModal
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import AddCardForm from './AddCardForm'; // Import the new form
import ProfileItemModal from './ProfileItemModal'; // Import the generic modal

// Load Stripe promise outside component to avoid recreating on render
// Use the exact variable name injected by Webpack DefinePlugin
const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY || '');

const CardManager: React.FC = () => {
    const { user } = useAuth(); // Get user info if needed for conditional rendering
    const [savedCards, setSavedCards] = useState<ApiSavedCard[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<boolean>(false); // Rename isSubmitting to actionLoading for clarity
    const [showAddCardForm, setShowAddCardForm] = useState<boolean>(false);

    // --- Confirmation Modal State ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [cardToDeletePmId, setCardToDeletePmId] = useState<string | null>(null);

    // State for Add Card Form
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
    const [addCardError, setAddCardError] = useState<string>('');

    // --- Refetch Logic (Extracted) ---
    const fetchCards = useCallback(async () => {
        // Resetting error state here as well
        setError(null); 
        // Set loading state specifically for fetching
        setIsLoading(true); 
        try {
            const response = await fetch('/api/cards');
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                }
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const data: ApiSavedCard[] = await response.json();
            setSavedCards(data);
        } catch (err: any) {
            console.error("Failed to fetch saved cards:", err);
            setError(err.message || 'Could not load saved cards.');
        } finally {
            setIsLoading(false);
        }
    }, []); // Empty dependency array means this function itself doesn't change

    // Fetch saved cards on component mount
    useEffect(() => {
        fetchCards();
    }, [fetchCards]); // Depend on the stable fetchCards function

    // --- Delete Logic ---
    const handleDeleteInitiate = (paymentMethodId: string) => {
        setCardToDeletePmId(paymentMethodId); // Store the ID
        setIsConfirmModalOpen(true);         // Open the modal
    };

    const confirmDelete = async () => {
        if (!cardToDeletePmId) return;

        setActionLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/cards/${cardToDeletePmId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                let errorMsg = 'Failed to delete card.';
                if (response.status === 404) {
                    errorMsg = 'Saved card not found.';
                } else if (response.status === 403) {
                     errorMsg = 'Forbidden: You do not own this card.';
                } else if (response.status === 401) {
                    errorMsg = 'Authentication required.';
                } else {
                    try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch {}
                }
                throw new Error(errorMsg);
            }

            // Update state by filtering out the deleted card
            setSavedCards(prevCards => prevCards.filter(card => card.stripePaymentMethodId !== cardToDeletePmId));
            closeConfirmModal(); // Close modal on success

        } catch (err: any) {
            console.error("Delete Card Error:", err);
            setError(err.message || 'Could not delete card.');
            // Keep modal open to show the error
        } finally {
            setActionLoading(false);
        }
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setCardToDeletePmId(null);
        setError(null); // Also clear error when manually closing
    };
    // --- End Delete Logic ---

    const handleSetDefault = async (paymentMethodId: string) => {
        setActionLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/cards/${paymentMethodId}/default`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }, // Good practice, even if no body
            });

            if (!response.ok) {
                let errorMsg = 'Failed to set default card.';
                if (response.status === 404) {
                    errorMsg = 'Saved card not found or user profile missing.';
                } else if (response.status === 401) {
                    errorMsg = 'Authentication required.';
                } else {
                     try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch {}
                }
                throw new Error(errorMsg);
            }

            // Update local state to reflect the new default card
            setSavedCards(prevCards =>
                prevCards.map(card => ({ 
                    ...card, 
                    isDefault: card.stripePaymentMethodId === paymentMethodId 
                }))
            );
            // Optionally show success message

        } catch (err: any) {
             console.error("Set Default Card Error:", err);
             setError(err.message || 'Could not set default card.');
        } finally {
            setActionLoading(false);
        }
    };

    // --- Add Card Logic ---
    const openAddCardModal = async () => {
        setError(null); 
        setAddCardError('');
        setActionLoading(true); // Show loading state while fetching secret
        setSetupIntentClientSecret(null);

        try {
            const response = await fetch('/api/cards/setup-intent', { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to initialize card setup.');
            }
            const data = await response.json();
            setSetupIntentClientSecret(data.clientSecret);
            setIsItemModalOpen(true); // Open modal *after* getting client secret
        } catch (err: any) {
            console.error("Failed to get setup intent client secret:", err);
            setError(`Error preparing card form: ${err.message}`); 
        } finally {
            setActionLoading(false); // Stop loading state
        }
    };

    const handleCardAdded = () => {
        closeItemModal(); // Close modal
        fetchCards(); // Refetch card list
    };

    const handleAddCardProcessingChange = (isProcessing: boolean) => {
        setActionLoading(isProcessing); // Link modal processing state to actionLoading
    };
    
    const handleAddCardError = (errorMessage: string) => {
        setAddCardError(errorMessage);
    };

    const closeItemModal = () => {
        setIsItemModalOpen(false);
        setSetupIntentClientSecret(null);
        setAddCardError('');
        setError(null);
        // Always refetch cards when the add card modal is closed
        // This ensures the list is up-to-date after potential webhook processing
        fetchCards(); 
    };

    // Stripe Elements options
    const stripeElementsOptions: StripeElementsOptions = {
        clientSecret: setupIntentClientSecret || undefined,
        appearance: { theme: 'stripe' }, // Basic Stripe appearance
    };

    return (
        <div className="mt-6"> {/* Match AddressManager outer div */} 
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Saved Payment Methods</h3> {/* Match AddressManager header */} 
            
            {isLoading && (
                <p className="text-slate-500">
                    <div className="spinner border-t-2 border-blue-500 border-solid rounded-full w-4 h-4 animate-spin inline-block mr-2"></div>
                    Loading payment methods...
                </p>
            )}
            {/* Display general errors NOT related to the modal */}
            {error && !isItemModalOpen && !isConfirmModalOpen && <p className="text-red-500 bg-red-50 p-3 rounded mb-4"><span className="font-bold">Error:</span> {error}</p>}

            {!isLoading && !error && (
                <div className="space-y-4"> {/* Match AddressManager list container */} 
                    {savedCards.length === 0 ? (
                        <p className="text-slate-500 bg-slate-50 p-4 rounded">You have no saved payment methods.</p>
                    ) : (
                        savedCards.map((card) => (
                             // Match AddressManager list item structure and styling
                            <div key={card.stripePaymentMethodId} className="border p-4 rounded-md shadow-sm bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex-grow"> {/* Match AddressManager text container */} 
                                    <p className="font-medium">
                                        <span className="uppercase">{card.brand}</span> ending in {card.last4}
                                        {card.isDefault && 
                                            <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full align-middle">Default</span>
                                        }
                                    </p>
                                    <p className="text-sm text-slate-600"> {/* Match text color */} 
                                        Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                                    </p>
                                </div>
                                <div className="mt-2 sm:mt-0 flex-shrink-0 flex items-center space-x-2"> {/* Match AddressManager button container */} 
                                    {!card.isDefault && (
                                        <button
                                            title="Set as Default"
                                            onClick={() => handleSetDefault(card.stripePaymentMethodId)}
                                            className="p-1.5 text-sm text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors" // Match style
                                            disabled={actionLoading}
                                        >
                                             <span className="material-symbols-outlined text-base align-middle">check_circle</span> {/* Match icon */} 
                                        </button>
                                    )}
                                    <button
                                        title="Delete Card"
                                        onClick={() => handleDeleteInitiate(card.stripePaymentMethodId)}
                                        className="p-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors" // Match style
                                        disabled={actionLoading}
                                    >
                                        <span className="material-symbols-outlined text-base align-middle">delete</span> {/* Match icon */} 
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {/* Match AddressManager button style */} 
                    <button
                        type="button"
                        onClick={openAddCardModal} 
                        className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium disabled:opacity-50"
                        disabled={isLoading || actionLoading} 
                    >
                         <span className="material-symbols-outlined text-base mr-1 align-middle">add</span> {/* Match icon */} 
                         {actionLoading && !isItemModalOpen ? (
                             <div className="spinner border-t-2 border-white border-solid rounded-full w-4 h-4 animate-spin mr-2"></div>
                         ) : null}
                        Add New Card
                    </button>
                </div>
            )}
            
            {/* Modal for Adding Card */} 
            <ProfileItemModal
                isOpen={isItemModalOpen}
                onClose={closeItemModal}
                title="Add New Card"
            >
                 {/* Display errors specific to adding card within the modal */} 
                 {addCardError && <p className="text-red-600 mb-3 text-sm">Error: {addCardError}</p>} 
                 {/* Conditionally render Elements based on clientSecret */} 
                 {setupIntentClientSecret ? (
                     <Elements options={stripeElementsOptions} stripe={stripePromise}>
                         <AddCardForm 
                             clientSecret={setupIntentClientSecret}
                             onError={handleAddCardError}
                             onCloseRequest={closeItemModal}
                         />
                     </Elements>
                 ) : (
                    // Show loading indicator while client secret is being fetched
                    <p className="text-slate-500">
                         <div className="spinner border-t-2 border-blue-500 border-solid rounded-full w-4 h-4 animate-spin inline-block mr-2"></div>
                         Initializing secure form...
                    </p>
                 )}
            </ProfileItemModal>

            {/* Confirmation Modal for Deleting Card */}
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmDelete}
                title="Delete Payment Method?"
                message={`Are you sure you want to delete this card ending in ${savedCards.find(c => c.stripePaymentMethodId === cardToDeletePmId)?.last4 ?? '****'}? This action cannot be undone.`}
                confirmButtonText="Delete"
                isLoading={actionLoading} // Use renamed state
            />
        </div>
    );
};

export default CardManager; 