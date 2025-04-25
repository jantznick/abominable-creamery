# Task: Feature - Saved Credit Cards

**Status:** In Progress

**Goal:** Allow logged-in users to securely save, manage, and reuse credit card payment methods for faster checkout, particularly for subscriptions.

**Related Features:**
*   [feature-subscriptions.md](./feature-subscriptions.md)
*   [feature-saved-addresses.md](./feature-saved-addresses.md)
*   [refactor-subscription-setup-intent.md](./refactor-subscription-setup-intent.md)

## Background

Similar to saved addresses, users should be able to manage their payment methods within their account profile. This involves securely capturing card details using Stripe, storing only non-sensitive identifiers (Stripe PaymentMethod ID), and allowing selection during checkout. For subscriptions, saving the card is often mandatory, and users should be clearly informed.

## Acceptance Criteria

1.  **Database:** A new `SavedCard` model exists, linked to the `User` model.
2.  **Security:** Full card numbers or CVCs are **never** stored in the local database. Only the Stripe `PaymentMethod` ID and display information (brand, last4, expiry) are stored.
3.  **API:** CRUD endpoints exist under `/api/cards` for managing saved cards (list, add, delete, set default).
4.  **Profile UI:** A section in the user profile allows viewing, adding (via Stripe Elements/Setup Intent), deleting, and setting a default saved card.
5.  **Checkout UI (One-Time Purchase):**
    *   Users can select a saved card.
    *   Users can add a new card using Stripe Elements.
    *   A checkbox allows saving the *newly entered* card for future use (triggers Setup Intent flow).
6.  **Checkout UI (Subscription Purchase):**
    *   Users can select a saved card.
    *   Users can add a new card using Stripe Elements (which will be automatically saved via Setup Intent).
    *   A clear notification message is displayed stating that the card used will be saved for recurring payments.
7.  **Stripe Integration:**
    *   Stripe Customers are created/retrieved for users saving cards.
    *   Stripe Setup Intents are used to securely collect and confirm new card details.
    *   The resulting `PaymentMethod` ID is stored locally and attached to the Stripe Customer.
    *   Payments/Subscription setups use the selected/saved `PaymentMethod` ID and `Customer` ID.

## Implementation Plan

### Phase 1: Database Schema Update

*   [X] **1. Define SavedCard Model (`prisma/schema.prisma`)**
*   [X] **2. Run Prisma Migration**
*   [X] **3. Generate Prisma Client**

### Phase 2: Backend API (Card Management)

*   [X] **4. Create Card API Routes (`src/server/routes/cards.ts`)**
*   [X] **5. Implement List Endpoint**
*   [X] **6. Implement Add Card Endpoint (Setup Intent Creation)**
*   [X] **7. Implement Webhook Handler (`setup_intent.succeeded`)** (Includes logic for profile saves and subscription flow saves)
*   [X] **8. Implement Delete Card Endpoint**
*   [X] **9. Implement Set Default Card Endpoint**
*   [X] **10. Mount Card Router (`serverRender.tsx`)**

### Phase 3: Frontend (Profile UI - Card Management)

*   [X] **11. Create Card Management Component (`src/components/profile/CardManager.tsx`)**
    *   [X] Display list of saved cards (fetched via `GET /api/cards`).
    *   [X] Show brand, last 4, expiry, default status.
    *   [X] Include "Delete" button (calls `DELETE /api/cards/:pmId`).
    *   [X] Include "Set as Default" button (calls `PUT /api/cards/:pmId/default`).
    *   [ ] Include "Add New Card" button/section.
*   [ ] **12. Implement Add Card Form (within `CardManager.tsx`):**
    *   [ ] Use `@stripe/react-stripe-js` and `Elements`.
    *   [ ] On "Add Card" click:
        *   [ ] Call `POST /api/cards/setup-intent` to get `clientSecret`.
        *   [ ] Render Stripe `PaymentElement`.
        *   [ ] On form submit:
            *   [ ] Call `stripe.confirmSetup()` with the `clientSecret`.
            *   [ ] Handle success/error (success means webhook will save it; call `onCardAdded`).
*   [ ] **13. Integrate into User Profile Page (`src/pages/Profile.tsx`):**
    *   [ ] Add `CardManager` component.

### Phase 4: Frontend (Checkout Integration)

*   [ ] **14. Modify Checkout Payment Component (`src/components/checkout/StripeCheckoutForm.tsx` or similar):**
    *   Fetch saved cards (`GET /api/cards`).
    *   Display radio buttons/options to select a saved card *or* add a new one.
    *   If "New Card" is selected, render the Stripe `PaymentElement`.
    *   **If Cart Contains Subscription:**
        *   Display notification: "Your card will be saved securely via Stripe for managing your subscription."
        *   Ensure the Setup Intent flow (from `POST /api/stripe/initiate-checkout`) is used. The webhook will automatically handle saving the card details if successful.
    *   **If Cart Contains Only One-Time Items:**
        *   If "New Card" selected, show a checkbox: "[ ] Save this card for future purchases".
        *   Modify `handleSubmit`:
            *   If saved card selected: Use Payment Intent, passing `payment_method: selectedPmId` and `customer: customerId` when creating it on the backend (modify `POST /api/stripe/initiate-checkout`). Confirm with `stripe.confirmPayment()`.
            *   If new card + "Save" checked: Use Setup Intent (`usage: 'on_session'`). Confirm with `stripe.confirmSetup()`. The webhook needs logic to create the Order *and* save the card.
            *   If new card + "Save" unchecked: Use Payment Intent. Confirm with `stripe.confirmPayment()`.
*   [ ] **15. Backend (`POST /api/stripe/initiate-checkout`):**
    *   Modify to accept an optional `paymentMethodId` from the frontend if a saved card is selected for a one-time purchase.
    *   If `paymentMethodId` is provided, create a Payment Intent with `payment_method: paymentMethodId`, `customer: customerId`, and `confirm: true` (or `off_session: false` depending on flow).
    *   Refine metadata handling for all scenarios (saving card, subscription vs one-time).
*   [ ] **16. Webhook Handler (`setup_intent.succeeded`):**
    *   Add logic to handle Setup Intents originating from the "Save card" checkbox during one-time checkouts. This webhook now needs to potentially:
        *   Save the card (`SavedCard` record, attach to customer).
        *   AND create the one-time `Order` record (using data from SI metadata).
    *   Ensure subscription setup still works correctly.

### Phase 5: Refinements

*   [ ] **17. Error Handling:** Robust error handling and user feedback for API calls and Stripe interactions.
*   [ ] **18. UI/UX:** Polish the UI for managing and selecting cards.
*   [ ] **19. Testing:** Add tests for API endpoints, webhook logic, and frontend components. Test all checkout scenarios (new/saved card, subscription/one-time, save checkbox). 