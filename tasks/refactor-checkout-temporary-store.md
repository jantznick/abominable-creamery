# Task: Refactor Checkout Flow to Use Temporary Server-Side Storage

**Status:** Not Started

**Estimate:** Medium

**Relevant Rules:** Core Philosophy (Simplicity), Architecture Adherence, Pattern Awareness, Quality

## 1. Problem Statement

The current checkout implementation (`/api/stripe/initiate-checkout` and `/api/stripe/webhook`) incorrectly uses the Stripe Intent `metadata` field to store the entire checkout context (user ID, cart items, shipping/contact info) as a JSON string. This approach has several critical flaws:

*   **Violates Stripe Best Practices:** Metadata is intended for small identifiers or flags, not large data blobs.
*   **Exceeds Size Limits:** The JSON string frequently exceeds Stripe's 500-character limit per metadata value, causing errors during `initiate-checkout` (e.g., for mixed carts).
*   **Fragile:** Relies on frontend correctly passing large, structured data and webhook correctly parsing it.
*   **Violates Project Rules:** Lacks simplicity, ignores standard patterns for handling state across requests/webhooks, and impacts quality/reliability.

An interim fix involved removing metadata transmission and disabling webhook processing, breaking the order/subscription creation flow.

## 2. Goal

Refactor the checkout and webhook flow to use a robust, standard pattern involving temporary server-side storage for checkout context, eliminating the misuse of Stripe metadata and restoring the database record creation process.

## 3. Proposed Solution: Temporary Server-Side Storage

Implement a system where:

1.  Checkout details are temporarily stored on the server associated with a unique ID (`checkoutAttemptId`).
2.  Only the `checkoutAttemptId` is passed in Stripe Intent metadata.
3.  Webhooks use the `checkoutAttemptId` from metadata to retrieve the full details from the temporary store to create database records.
4.  Add the `checkoutAttemptId` to the `Order` and `Subscription` database tables for traceability.

## 4. Implementation Steps

### Backend (`server/`)

1.  **Choose & Implement Temporary Storage:**
    *   Select a suitable temporary store (e.g., Redis with TTL, temporary DB table).
    *   Implement functions:
        *   `saveCheckoutAttempt(data: CheckoutContext): Promise<string>` (returns unique `checkoutAttemptId`)
        *   `getCheckoutAttempt(id: string): Promise<CheckoutContext | null>`
        *   `deleteCheckoutAttempt(id: string): Promise<void>`
    *   Ensure appropriate indexing and cleanup mechanisms (e.g., TTL, explicit deletion).
2.  **Update Prisma Schema:**
    *   Add `checkoutAttemptId String? @unique` (or `@index`) to the `Order` model in `prisma/schema.prisma`.
    *   Add `checkoutAttemptId String? @index` to the `Subscription` model in `prisma/schema.prisma`.
    *   Run `npx prisma migrate dev --name add_checkout_attempt_id`.
3.  **Modify `/api/stripe/initiate-checkout` (`server/routes/stripe.ts`):**
    *   Generate a unique `checkoutAttemptId` (e.g., `crypto.randomUUID()`).
    *   Call `saveCheckoutAttempt` with the *full* checkout context (user ID, items, address, contact).
    *   Modify `stripe.paymentIntents.create` and `stripe.setupIntents.create` calls to include **only** `metadata: { checkoutAttemptId: theGeneratedId }`.
    *   Update the response to the frontend to return `{ clientSecret, checkoutAttemptId }`.
4.  **Refactor `/api/stripe/webhook` Handlers (`server/routes/stripe.ts`):**
    *   Uncomment the logic within `case 'setup_intent.succeeded':` and `case 'payment_intent.succeeded':`.
    *   **Remove** parsing of `checkout_context` from metadata.
    *   Extract `checkoutAttemptId` from `event.data.object.metadata.checkoutAttemptId`.
    *   If `checkoutAttemptId` exists, call `getCheckoutAttempt(checkoutAttemptId)`.
    *   If details are retrieved successfully:
        *   Use the retrieved `userId`, `cartItems`, `contactInfo`, `shippingAddress` for database operations.
        *   Modify `prisma.order.create` and `prisma.subscription.create` calls to include the `checkoutAttemptId` in the data being saved.
        *   Call `deleteCheckoutAttempt(checkoutAttemptId)` after the database transaction succeeds.
    *   Implement robust error handling (e.g., if `checkoutAttemptId` is missing, if `getCheckoutAttempt` fails, if DB transaction fails).

### Frontend (`src/`)

5.  **Modify `Checkout.tsx`:**
    *   Update the `fetch` call to `/api/stripe/initiate-checkout` to expect `{ clientSecret, checkoutAttemptId }` in the response.
    *   Store the received `checkoutAttemptId` (e.g., in component state).
    *   Modify `StripeCheckoutForm`: Instead of saving the full `checkoutData` to `sessionStorage`, save **only** the `checkoutAttemptId`.
6.  **Modify `OrderConfirmation.tsx`:**
    *   Update Effect 1: Read `checkoutAttemptId` from `sessionStorage` instead of the full checkout data.
    *   Update Effect 2 (Payment Intent Flow): When calling `/api/orders` (or if order creation logic is moved entirely to the webhook), ensure the necessary identifiers (`paymentIntentId`, `checkoutAttemptId`) are available/sent as needed by the (potentially refactored) backend endpoint. *Note: The PI flow might change significantly depending on how backend creation is handled.*

## 5. Acceptance Criteria

*   Checkout process (`/api/stripe/initiate-checkout`) no longer attempts to put large JSON context into Stripe metadata.
*   `initiate-checkout` only sends `checkoutAttemptId` in metadata.
*   Frontend correctly saves and retrieves `checkoutAttemptId` via `sessionStorage`.
*   Successful PaymentIntents trigger the `payment_intent.succeeded` webhook.
*   Successful SetupIntents trigger the `setup_intent.succeeded` webhook.
*   Webhook handlers correctly retrieve full checkout details from the temporary store using `checkoutAttemptId` from metadata.
*   Webhook handlers correctly create `Order` and/or `Subscription` records in the database with the associated `checkoutAttemptId`.
*   Temporary checkout data is cleaned up after successful processing.
*   Mixed cart checkouts complete without metadata size errors.
*   One-time purchases and subscription purchases result in correct database records.

## 6. Open Questions/Considerations

*   Choice of temporary storage technology (Redis vs. DB table vs. other).
*   Error handling strategy if temporary data is missing when webhook arrives.
*   Cleanup strategy for temporary data (TTL vs. explicit delete vs. scheduled job).
*   Exact flow for `/api/orders` vs. webhook creation logic for Payment Intents needs review. 