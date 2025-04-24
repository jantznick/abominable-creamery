# Task: Improve Order Confirmation UX for Setup Intents

**Status:** Not Started

**Goal:** Modify the order confirmation page (`/order-confirmation`) to display appropriate messaging based on whether the preceding checkout flow involved a Setup Intent (for subscriptions) or a Payment Intent (for one-time purchases), acknowledging the asynchronous nature of subscription activation.

**Related Features:**
*   [feature-subscriptions.md](./feature-subscriptions.md)
*   Follows: [refactor-subscription-setup-intent.md](./refactor-subscription-setup-intent.md)

## Background

After implementing the Setup Intent flow for subscriptions, the user is redirected to the confirmation page immediately after `stripe.confirmSetup()` resolves successfully client-side. However, the backend webhook (`setup_intent.succeeded`) which actually creates the Stripe Subscription and local records runs asynchronously. Fetching the status of the *Setup Intent* on the confirmation page will show `succeeded`, but this doesn't confirm the *Subscription* is active or that the first *Invoice* has been paid. This can lead to confusing or inaccurate messages if the page assumes Setup Intent success equals full order completion.

## Acceptance Criteria

1.  The `OrderConfirmation` page correctly reads URL parameters (`payment_intent`, `payment_intent_client_secret`, `setup_intent`, `setup_intent_client_secret`, `redirect_status`).
2.  **If `payment_intent` is present:** The existing logic to fetch the Payment Intent status from the backend (`/api/stripe/payment-intent/:id`) and display success/processing/failure messages remains.
3.  **If `setup_intent` is present:**
    *   The page checks the `redirect_status` parameter.
    *   If `redirect_status=succeeded`:
        *   Display a clear, positive message acknowledging the setup success but indicating processing is ongoing (e.g., "Your payment method was saved successfully! Your subscription is being finalized and will appear in your account shortly.").
        *   **Do not** attempt to fetch the Setup Intent status just to display "Succeeded", as this is misleading regarding the subscription state.
        *   Optionally, still retrieve saved checkout data from `sessionStorage` to display a summary of the *intended* order.
    *   If `redirect_status` is *not* `succeeded` (e.g., `requires_action`, `failed`):
        *   Fetch the Setup Intent status from the backend (`/api/stripe/setup-intent/:id`) to get more details.
        *   Display an appropriate error message based on the fetched status or the `redirect_status`.
4.  Checkout data stored in `sessionStorage` (`checkoutDataForConfirmation`) is cleared after being read/displayed.
5.  The cart (`useCart`) is cleared upon displaying a successful confirmation message (for both Payment Intent and Setup Intent flows).

## Implementation Steps

1.  **Locate Component:** Identify the React component responsible for the `/order-confirmation` route (likely `src/pages/OrderConfirmation.tsx`).
2.  **URL Parameter Logic:**
    *   Use `useSearchParams` hook from `react-router-dom` to read all relevant Stripe redirect parameters.
    *   Implement conditional logic at the top level based on whether `setup_intent` or `payment_intent` is present.
3.  **Setup Intent Flow Logic:**
    *   Inside the `if (setup_intent)` block, check the `redirect_status`.
    *   If `'succeeded'`, set state to display the generic subscription processing message.
    *   If *not* `'succeeded'`, implement the fetch to `/api/stripe/setup-intent/:id` (similar to the existing PI fetch) and set state to display an error based on the result.
4.  **Payment Intent Flow Logic:**
    *   Inside the `if (payment_intent)` block, keep or refine the existing logic to fetch from `/api/stripe/payment-intent/:id` and display status.
5.  **UI Rendering:**
    *   Adjust the JSX to conditionally render different headings, paragraphs, and potentially status indicators based on the determined state (Setup Intent Success, Payment Intent Success, Payment Intent Processing, Error).
6.  **Session Storage & Cart Clearing:**
    *   Ensure `sessionStorage.removeItem('checkoutDataForConfirmation')` is called within a `useEffect` cleanup function or after the data is used.
    *   Ensure `clearCart()` is called within a `useEffect` hook that runs *only once* after a successful confirmation state (either PI succeeded or SI succeeded) is determined.
7.  **Backend Endpoint:** Ensure the backend route `GET /api/stripe/setup-intent/:setupIntentId` exists and correctly retrieves and returns the Setup Intent status (already added in previous step).
8.  **Testing:**
    *   Test subscription checkout -> verify generic success message.
    *   Test one-time checkout -> verify specific PI success/processing message.
    *   Simulate failed Setup Intent redirect (if possible) -> verify error message.
    *   Verify cart is cleared and session storage is cleared in success cases.

## Future Considerations

*   Could potentially add a short delay/spinner specifically for the SI success case before showing the message, but the generic message is safer.
*   Could add a link to the user's account/subscriptions page in the success message. 