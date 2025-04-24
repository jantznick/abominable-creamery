# Feature: Subscription Purchasing

**Status:** Partially Implemented / Planned

## 1. Overview

This feature allows users to subscribe to receive recurring deliveries of ice cream flavors. The initial frontend work on the product page (`Flavor.tsx`) is complete, allowing users to select a subscription option via a checkbox. This plan outlines the remaining tasks to fully integrate subscriptions into the cart, checkout, and backend systems.

## 2. Key Features & Goals

*   **Product Page:** Allow users to choose between one-time purchase and "Subscribe & Save" for eligible products. (Done)
*   **Cart:** Visually distinguish subscription items from one-time purchases, showing the recurring interval (e.g., "monthly").
*   **Checkout:** Handle carts containing both one-time items and subscription items using a single Stripe Checkout session.
*   **Backend:** Securely create Stripe Checkout sessions reflecting the cart contents.
*   **Database:** Store subscription details (Stripe IDs, status, interval, linked user) locally.
*   **Webhooks:** Process Stripe webhooks (specifically `checkout.session.completed`) to create/update local subscription records upon successful checkout.

## 3. Technical Approach

*   **Data Model:**
    *   Use Stripe Products and Prices.
    *   One-time Prices eligible for subscription will have `metadata.subscriptionId` pointing to the corresponding recurring Stripe Price ID.
    *   Recurring Stripe Prices will have `recurring.interval` set (e.g., 'month').
*   **Checkout:**
    *   Utilize **Stripe Checkout Sessions**.
    *   When the user proceeds to checkout, the backend will create a Checkout Session including:
        *   `line_items` for one-time purchase products (using Price IDs).
        *   `line_items` for subscription products (using recurring Price IDs). Stripe automatically detects the `recurring` property and handles the subscription setup.
        *   Set `mode: 'payment'` (Stripe handles detecting recurring items to enable subscription setup). Alternatively, investigate if `mode: 'subscription'` combined with one-time `line_items` is feasible/better.
    *   The frontend will redirect the user to the Stripe-hosted Checkout page using the session ID.
*   **Backend Persistence:**
    *   A new `Subscription` table will be added to the database (`prisma/schema.prisma`).
    *   Upon receiving a successful `checkout.session.completed` webhook event from Stripe, the backend will:
        *   Create corresponding `Order` and `OrderItem` records for the *entire* purchase (as currently done).
        *   Create a new record in the `Subscription` table containing the `stripeSubscriptionId`, `userId`, `stripePriceId`, `status`, `interval`, etc., extracted from the webhook payload.
*   **Frontend State:**
    *   `CartContext` stores `isSubscription` and `recurringInterval` flags. (Done)

## 4. Database Schema Changes (`prisma/schema.prisma`)

*   **Add `Subscription` model:**
    ```prisma
    model Subscription {
      id                  String      @id @default(cuid())
      userId              String
      user                User        @relation(fields: [userId], references: [id])
      stripeSubscriptionId String      @unique // From Stripe event checkout.session.completed -> subscription
      stripePriceId       String      // The ID of the recurring Stripe Price object
      status              String      // e.g., "active", "canceled", "incomplete", etc. (Matches Stripe statuses)
      interval            String      // e.g., "month", "week"
      currentPeriodEnd    DateTime    // From Stripe event
      cancelAtPeriodEnd   Boolean     @default(false)
      createdAt           DateTime    @default(now())
      updatedAt           DateTime    @updatedAt

      @@index([userId])
    }
    ```
*   **Add relation to `User` model:**
    ```prisma
    model User {
      // ... other fields
      subscriptions Subscription[]
    }
    ```
*   **(Optional) Consider adding `stripeSubscriptionId` to `OrderItem`:** Add an optional `stripeSubscriptionId String?` field to `OrderItem` if a direct link from the initial order item to the resulting subscription is desired. This might be redundant if the `Subscription` table holds enough info.

## 5. API Changes

*   **`/create-payment-intent` Endpoint:**
    *   **Rename/Replace:** Replace this with a new endpoint, e.g., `POST /api/checkout/create-session`.
    *   **Functionality:**
        *   Accepts cart items (including subscription flags) from the frontend request.
        *   Constructs `line_items` array for Stripe Checkout Session, mapping cart items to the correct Stripe Price IDs (using the subscription Price ID for subscribed items).
        *   Sets appropriate `success_url` and `cancel_url`.
        *   Creates the Stripe Checkout Session (`stripe.checkout.sessions.create`).
        *   Returns the `sessionId` to the frontend.
*   **`POST /api/webhooks/stripe` Endpoint:**
    *   **Enhance:** Add a handler for the `checkout.session.completed` event type.
    *   **Functionality:**
        *   Verify the webhook signature.
        *   Parse the `session` object from the event data.
        *   Retrieve relevant details (customer ID, subscription ID, line items, status, interval, period end, price ID).
        *   Find or create the corresponding `User` based on `customerId` or `client_reference_id`.
        *   Create the `Order` and `OrderItem` records (ensure atomicity if possible).
        *   Create the `Subscription` record in the database using the extracted details.
        *   Handle potential errors gracefully.

## 6. Frontend Changes

*   **`src/pages/Cart.tsx`:**
    *   Update item rendering to check `item.isSubscription`.
    *   If true, display "(Subscription)" and the `item.recurringInterval` (e.g., " / month").
    *   Ensure the "Proceed to Checkout" button triggers the new checkout flow.
*   **`src/pages/Checkout.tsx`:**
    *   **Major Refactor:** Replace the current Payment Element integration.
    *   On load or button click ("Proceed to Payment"):
        *   Send cart details to the new `/api/checkout/create-session` backend endpoint.
        *   Receive the `sessionId`.
        *   Use `@stripe/stripe-js` `redirectToCheckout({ sessionId })` method to redirect the user to Stripe.
    *   Remove existing `/create-payment-intent` call and related Payment Element setup/state.
*   **`src/pages/OrderConfirmation.tsx`:**
    *   Adapt logic to handle the redirect back from Stripe Checkout.
    *   Stripe redirects to the `success_url` with `session_id={CHECKOUT_SESSION_ID}` in the query parameters.
    *   On load, retrieve the `session_id`.
    *   (Optional but recommended) Make a request to a new backend endpoint (e.g., `GET /api/checkout/session-status?session_id=...`) to verify the session payment status on the server before showing the success message. This avoids relying solely on the client being redirected to the success URL. The backend endpoint would use `stripe.checkout.sessions.retrieve(sessionId)`.
    *   Display success/failure based on the verified session status.

## 7. Tasks

*   **Task 1 (Backend):** Define `Subscription` model in `prisma/schema.prisma` and add relation to `User`.
*   **Task 2 (Backend):** Run `npx prisma migrate dev` to apply schema changes.
*   **Task 3 (Backend):** Implement `POST /api/checkout/create-session` endpoint logic.
*   **Task 4 (Backend):** Enhance `POST /api/webhooks/stripe` to handle `checkout.session.completed` event and create `Subscription` records.
*   **Task 5 (Frontend):** Update `src/pages/Cart.tsx` to visually differentiate subscription items.
*   **Task 6 (Frontend):** Refactor `src/pages/Checkout.tsx` to call `/api/checkout/create-session` and use `redirectToCheckout`.
*   **Task 7 (Frontend):** Adapt `src/pages/OrderConfirmation.tsx` to handle redirects from Stripe Checkout and potentially verify session status.
*   **Task 8 (Testing):** Thoroughly test scenarios:
    *   One-time purchase only.
    *   Subscription purchase only.
    *   Mixed cart (one-time + subscription).
    *   Webhook processing correctly creates DB records.
    *   Error handling (e.g., failed payment in Stripe Checkout).

## 8. Future Considerations

*   User account page to view/manage active subscriptions (cancel, update payment method via Stripe Customer Portal).
*   Handling other Stripe subscription webhooks (e.g., `invoice.payment_failed`, `customer.subscription.deleted`) to update local `Subscription` status.
*   More robust error handling and retry mechanisms for webhook processing. 