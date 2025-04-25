import React from 'react';
import classNames from 'classnames';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';

import { SectionHeader } from './SectionHeader';
import { useAuth } from '../../context/AuthContext'; // Needed for PaymentSectionContent
import { ApiSavedCard } from '../../types/data'; // Needed for PaymentSectionContent

// --- Define PaymentSectionContent Props (moved from Checkout.tsx) ---
interface PaymentSectionContentProps {
	clientSecret: string;
	checkoutAttemptId: string;
	auth: ReturnType<typeof useAuth>;
	savedCards: ApiSavedCard[];
	isLoadingCards: boolean;
	errorLoadingCards: string | null;
	selectedCardId: string;
	handleSelectCard: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	containsSubscription: boolean;
	saveNewCardForFuture: boolean;
	setSaveNewCardForFuture: (value: boolean) => void;
	total: number;
}

// --- Define StripeCheckoutForm Props (moved from Checkout.tsx) ---
interface StripeCheckoutFormProps {
    clientSecret: string;
    checkoutAttemptId: string;
}


// --- StripeCheckoutForm Component (moved from Checkout.tsx) ---
const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = ({ clientSecret, checkoutAttemptId }) => {
	const stripe = useStripe();
	const elements = useElements();
	const [message, setMessage] = React.useState<string | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!stripe || !elements || !clientSecret || !checkoutAttemptId) {
			console.error("Stripe.js not loaded, missing client secret, OR missing checkoutAttemptId.");
			setMessage("Payment system not ready. Please wait or refresh.");
			return;
		}
		try {
			sessionStorage.setItem('checkoutDataForConfirmation', checkoutAttemptId);
			console.log("Saved checkoutAttemptId to sessionStorage.");
		} catch (error) {
			console.error("Error saving checkoutAttemptId to sessionStorage:", error);
			setMessage("Error preparing session data. Please try again.");
			return;
		}
		setIsLoading(true);
		setMessage(null);
		let error: { message?: string, type?: string } | null = null;
		if (clientSecret.startsWith('seti_')) {
			console.log("Confirming SetupIntent...");
			const { error: setupError } = await stripe.confirmSetup({
				elements,
				confirmParams: { return_url: `${window.location.origin}/order-confirmation` },
			});
			error = setupError || null;
		} else if (clientSecret.startsWith('pi_')) {
			console.log("Confirming PaymentIntent...");
			const { error: paymentError } = await stripe.confirmPayment({
				elements,
				confirmParams: { return_url: `${window.location.origin}/order-confirmation` },
			});
			error = paymentError || null;
		} else {
			console.error("Invalid client secret format:", clientSecret);
			setMessage("Invalid payment session. Please try again.");
			setIsLoading(false);
			return;
		}
		if (error) {
			if (error.type === "card_error" || error.type === "validation_error") {
				setMessage(error.message || "An unexpected payment error occurred.");
			} else {
				setMessage("An unexpected payment error occurred.");
			}
		} else {
			console.log("Payment/Setup confirmed client-side (likely redirecting)...");
		}
		setIsLoading(false);
	};

	return (
		<form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
			<PaymentElement id="payment-element" options={{ layout: "tabs" }} />
			<button
				disabled={isLoading || !stripe || !elements}
				id="submit"
				className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<span id="button-text">
					{isLoading ? <div className="spinner border-t-2 border-white border-solid rounded-full w-5 h-5 animate-spin mx-auto"></div> : "Pay now"}
				</span>
			</button>
			{message && <div id="payment-message" className="mt-2 text-center text-red-600 text-sm">{message}</div>}
		</form>
	)
};

// --- PaymentSectionContent Component (moved from Checkout.tsx) ---
const PaymentSectionContent: React.FC<PaymentSectionContentProps> = ({
	clientSecret,
	checkoutAttemptId,
	auth,
	savedCards,
	isLoadingCards,
	errorLoadingCards,
	selectedCardId,
	handleSelectCard,
	containsSubscription,
	saveNewCardForFuture,
	setSaveNewCardForFuture,
	total
}) => {
	const stripe = useStripe();
	const navigate = useNavigate();
	const [isPayingWithSavedCard, setIsPayingWithSavedCard] = React.useState(false);
	const [savedCardPaymentError, setSavedCardPaymentError] = React.useState<string | null>(null);
	const [isSettingUpWithSavedCard, setIsSettingUpWithSavedCard] = React.useState(false);
	const [savedCardSetupError, setSavedCardSetupError] = React.useState<string | null>(null);

	const handlePayWithSavedCard = async () => {
        if (!stripe || !clientSecret || !selectedCardId || !checkoutAttemptId) {
            console.error("Missing Stripe, clientSecret, selectedCardId, or checkoutAttemptId for saved card payment.");
            setSavedCardPaymentError("Payment system not ready or card not selected.");
            return;
        }
        try {
            sessionStorage.setItem('checkoutDataForConfirmation', checkoutAttemptId);
            console.log("Saved checkoutAttemptId to sessionStorage.");
        } catch (error) {
            console.error("Error saving checkoutAttemptId to sessionStorage:", error);
            setSavedCardPaymentError("Error preparing session data. Please try again.");
            return;
        }
        setIsPayingWithSavedCard(true);
        setSavedCardPaymentError(null);
        console.log(`Confirming PaymentIntent ${clientSecret} with saved card ${selectedCardId}`);
        const { error } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: selectedCardId,
        });
        if (error) {
            console.error("Error confirming saved card payment:", error);
            setSavedCardPaymentError(error.message || "Failed to process payment with saved card.");
        } else {
            console.log("Saved card payment successful (client-side), redirecting manually...");
            // Construct PI ID from clientSecret
            const paymentIntentId = clientSecret.split('_secret')[0];
            navigate(`/order-confirmation?payment_intent=${paymentIntentId}&payment_intent_client_secret=${clientSecret}&redirect_status=succeeded`);
        }
        setIsPayingWithSavedCard(false);
    };

	const handleSetupWithSavedCard = async () => {
		if (!stripe || !clientSecret || !selectedCardId || !checkoutAttemptId) {
			console.error("Missing Stripe, clientSecret, selectedCardId, or checkoutAttemptId for saved card setup.");
			setSavedCardSetupError("Payment system not ready or card not selected.");
			return;
		}
		try {
			sessionStorage.setItem('checkoutDataForConfirmation', checkoutAttemptId);
			console.log("Saved checkoutAttemptId to sessionStorage for SetupIntent.");
		} catch (error) {
			console.error("Error saving checkoutAttemptId to sessionStorage:", error);
			setSavedCardSetupError("Error preparing session data. Please try again.");
			return;
		}
		setIsSettingUpWithSavedCard(true);
		setSavedCardSetupError(null);
		console.log(`Confirming SetupIntent ${clientSecret} with saved card ${selectedCardId}`);
		const { error } = await stripe.confirmSetup({
			clientSecret,
			confirmParams: {
				return_url: `${window.location.origin}/order-confirmation`,
				payment_method: selectedCardId,
			},
		});
		if (error) {
			console.error("Error confirming saved card setup:", error);
			setSavedCardSetupError(error.message || "Failed to confirm payment method setup.");
            setIsSettingUpWithSavedCard(false); // Ensure loading stops on error
		} else {
			console.log("Saved card setup successful (client-side), Stripe should redirect...");
            // No need to set loading false here, redirection handles it
		}
	};

	return (
		<>
			{auth.user && (
				<div className="mb-4">
					<label htmlFor="saved-card-select" className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
					{isLoadingCards && <p className="text-sm text-slate-500">Loading saved cards...</p>}
					{errorLoadingCards && <p className="text-sm text-red-600">Error loading cards: {errorLoadingCards}</p>}
					{!isLoadingCards && (
						<select
							id="saved-card-select"
							value={selectedCardId}
							onChange={handleSelectCard}
							className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
							disabled={savedCards.length === 0}
						>
							<option value="">Enter New Card Details</option>
							{savedCards.map(card => (
								<option key={card.stripePaymentMethodId} value={card.stripePaymentMethodId}>
									{card.brand.toUpperCase()} ending in {card.last4} {card.isDefault ? '(Default)' : ''}
								</option>
							))}
						</select>
					)}
				</div>
			)}
			{containsSubscription && auth.user && selectedCardId === '' && (
				<div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
					<span className="font-semibold">Note:</span> Your payment method will be saved for managing your subscription.
				</div>
			)}
			{(!auth.user || selectedCardId === '') ? (
				<StripeCheckoutForm clientSecret={clientSecret} checkoutAttemptId={checkoutAttemptId} />
			) : (
				<div className="p-4 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 space-y-3">
					<p>Using saved card: <span className="font-medium">{savedCards.find(c => c.stripePaymentMethodId === selectedCardId)?.brand.toUpperCase()} ending in {savedCards.find(c => c.stripePaymentMethodId === selectedCardId)?.last4}</span>.</p>
					<button
						onClick={containsSubscription ? handleSetupWithSavedCard : handlePayWithSavedCard}
						disabled={(containsSubscription ? isSettingUpWithSavedCard : isPayingWithSavedCard) || !stripe || !clientSecret || !selectedCardId}
						className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{(containsSubscription ? isSettingUpWithSavedCard : isPayingWithSavedCard) ? (
							<div className="spinner border-t-2 border-white border-solid rounded-full w-5 h-5 animate-spin mx-auto"></div>
						) : (
							containsSubscription ? 'Confirm Payment Method for Subscription' : `Pay $${total.toFixed(2)} with Saved Card`
						)}
					</button>
					{(containsSubscription ? savedCardSetupError : savedCardPaymentError) &&
						<p className="text-red-600 text-sm mt-2 text-center">{containsSubscription ? savedCardSetupError : savedCardPaymentError}</p>
					}
				</div>
			)}
			{auth.user && selectedCardId === '' && !containsSubscription && (
				<div className="flex items-center mt-4 pt-4 border-t border-slate-200">
					<input
						id="saveNewCardForFuture"
						name="saveNewCardForFuture"
						type="checkbox"
						checked={saveNewCardForFuture}
						onChange={(e) => setSaveNewCardForFuture(e.target.checked)}
						className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
					/>
					<label htmlFor="saveNewCardForFuture" className="ml-2 block text-sm text-gray-900">Save this card for future purchases</label>
				</div>
			)}
		</>
	);
};


// --- Define PaymentSection Props ---
interface PaymentSectionProps {
    // State related to this section
    notes: string;
    setNotes: (value: string) => void;
    isActive: boolean;
    isShippingComplete: boolean;

    // State related to Stripe intent loading
    clientSecret: string | null;
    checkoutAttemptId: string | null;
    isLoadingSecret: boolean;
    errorLoadingSecret: string | null;

    // Props needed for PaymentSectionContent
    auth: ReturnType<typeof useAuth>;
	savedCards: ApiSavedCard[];
	isLoadingCards: boolean;
	errorLoadingCards: string | null;
	selectedCardId: string;
	handleSelectCard: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	containsSubscription: boolean;
	saveNewCardForFuture: boolean;
	setSaveNewCardForFuture: (value: boolean) => void;
	total: number;
}

// --- Main PaymentSection Component ---
export const PaymentSection: React.FC<PaymentSectionProps> = ({
    notes, setNotes, isActive, isShippingComplete,
    clientSecret, checkoutAttemptId, isLoadingSecret, errorLoadingSecret,
    // Pass down props for PaymentSectionContent
    auth, savedCards, isLoadingCards, errorLoadingCards, selectedCardId, handleSelectCard,
    containsSubscription, saveNewCardForFuture, setSaveNewCardForFuture, total
}) => {
    // Load Stripe Promise here, or ensure it's passed down/globally available
    const stripePromise = process.env.STRIPE_PUBLISHABLE_KEY
        ? loadStripe(process.env.STRIPE_PUBLISHABLE_KEY)
        : null; // Handle case where key might be missing

    // Stripe Elements options (can be defined here as they depend on clientSecret)
	const appearance = { theme: 'stripe' as const };
	const options: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance } : undefined;

    return (
        <div className={classNames(
            "bg-white p-6 rounded-lg shadow-md",
            { 'opacity-50 pointer-events-none': !isShippingComplete }
        )}
        >
            <SectionHeader
                title="3. Payment"
                isComplete={false} // Payment section is never marked 'complete' visually
                isActive={isActive}
            />
            <div className="mb-6">
                <label htmlFor="orderNotes" className="block text-sm font-medium text-slate-700 mb-1">
                    Order Notes (Optional)
                </label>
                <textarea
                    id="orderNotes"
                    name="orderNotes"
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                    placeholder="Add any special instructions or notes for your order..."
                    disabled={!isActive} // Disable notes if not the active section
                />
            </div>

            {/* Show Payment content IF this section is active AND previous is complete */}
            {isActive && isShippingComplete ? (
                <div className="space-y-4">
                    {isLoadingSecret && <p className="text-center text-slate-500"><div className="spinner border-t-2 border-indigo-500 border-solid rounded-full w-5 h-5 animate-spin mx-auto mb-2"></div>Initializing payment...</p>}
                    {errorLoadingSecret && <p className="text-center text-red-600">{errorLoadingSecret}</p>}
                    {!clientSecret && !checkoutAttemptId && !isLoadingSecret && !errorLoadingSecret && (
                        <p className="text-center text-red-600">Failed to initialize payment session. Please refresh or contact support.</p>
                    )}

                    {/* Render Elements provider only when client secret etc. are ready */}
                    {clientSecret && checkoutAttemptId && stripePromise && options ? (
                        <Elements options={options} stripe={stripePromise}>
                            <PaymentSectionContent
                                clientSecret={clientSecret}
                                checkoutAttemptId={checkoutAttemptId}
                                auth={auth}
                                savedCards={savedCards}
                                isLoadingCards={isLoadingCards}
                                errorLoadingCards={errorLoadingCards}
                                selectedCardId={selectedCardId}
                                handleSelectCard={handleSelectCard}
                                containsSubscription={containsSubscription}
                                saveNewCardForFuture={saveNewCardForFuture}
                                setSaveNewCardForFuture={setSaveNewCardForFuture}
                                total={total}
                            />
                        </Elements>
                    ) : null /* Don't render Elements/Content if prerequisites aren't met */}
                </div>
            ) : null}
        </div>
    );
}; 