# Task: Refactor Subscription Creation Flow

**Status:** Not Started

**Goal:** Modify the checkout process to create the Stripe Subscription *first*, allowing it to generate the necessary Payment Intent for the initial invoice (including one-time items). This aligns better with Stripe's intended flow for subscriptions initiated with an immediate payment and resolves issues with subscriptions remaining `incomplete`.

**Related Features:**
*   [feature-subscriptions.md](./feature-subscriptions.md)
*   [feature-stripe-products.md](./feature-stripe-products.md)

## Background

The current flow creates a Payment Intent first for the total cart amount. Upon successful payment (`payment_intent.succeeded` webhook), it then separately creates a Stripe Subscription if applicable. This leads to the subscription's first invoice not being automatically paid by the initial Payment Intent, causing the subscription to remain `incomplete` until subsequent webhooks (`invoice.paid`, `customer.subscription.updated`) are correctly handled. These subsequent webhooks were also not being correctly processed.

## Acceptance Criteria

1.  When a user checks out with subscription items (and potentially one-time items):
    *   A Stripe Customer is found or created.
    *   A *single* Stripe Subscription object is created *before* payment is confirmed.
    *   One-time items are added to the subscription's *first* invoice using `add_invoice_items`.
    *   The subscription creation call uses `expand: ['latest_invoice.payment_intent']` to get the client secret for the invoice's payment intent.
    *   Relevant context (user ID, subscription ID, original cart details) is temporarily stored (e.g., in a `PendingOrderContext` table) keyed by the invoice's Payment Intent ID.
    *   The frontend receives *only* the `client_secret` for the invoice's Payment Intent.
2.  The user completes payment using the standard Stripe Payment Element.
3.  The `invoice.paid` webhook handler:
    *   Retrieves the temporarily stored context using the Payment Intent ID from the invoice event.
    *   Creates the local `Order` and `OrderItem` records using the retrieved context.
    *   Links the `Order` to the `Subscription` using the `subscription` ID from the invoice event.
    *   Deletes the temporary context record.
4.  The `customer.subscription.updated` webhook handler:
    *   Updates the status, `currentPeriodEnd`, and other relevant fields of the *existing* local `Subscription` record.
    *   If the local record doesn't exist *and* the incoming status is activating (`active` or `trialing`), it creates the local `Subscription` record (this handles edge cases or potential race conditions).
5.  The local `Subscription` record correctly reflects the `active` status and `currentPeriodEnd` after the flow completes.
6.  The original logic in the `payment_intent.succeeded` webhook for creating subscriptions is removed.

## Implementation Steps

1.  **Schema:** Define and migrate a new Prisma model `PendingOrderContext` (or similar name) to store temporary checkout context.
    *   Fields: `paymentIntentId` (String, unique index), `userId` (Int, nullable?), `stripeSubscriptionId` (String), `cartDetails` (String/JSON), `createdAt` (DateTime).
2.  **API Endpoint (Checkout Initiation):**
    *   Refactor `POST /api/stripe/create-payment-intent` (or create `POST /api/stripe/create-subscription`).
    *   Implement logic to find/create Stripe Customer.
    *   Separate cart items into `subscriptionItems` and `oneTimeItems`.
    *   Call `stripe.subscriptions.create` with `customer`, `items` (for subs), `add_invoice_items` (for one-time), `payment_behavior: 'default_incomplete'`, `payment_settings: { save_default_payment_method: 'on_subscription' }`, `expand: ['latest_invoice.payment_intent']`, and necessary `metadata`.
    *   Extract `client_secret`, `paymentIntentId`, `subscriptionId`, `invoiceId` from the response.
    *   Create a record in `PendingOrderContext` table with `paymentIntentId`, `userId`, `subscriptionId`, and stringified `cartDetails`.
    *   Return `{ clientSecret: client_secret }` to the frontend.
    *   Add robust error handling.
3.  **Webhook Handler (`payment_intent.succeeded`):**
    *   Remove the existing logic that creates `Subscription` records. This event is no longer the primary trigger for subscription creation/updates in this flow. (It might still be relevant for non-subscription orders or potentially logging).
4.  **Webhook Handler (`invoice.paid`):**
    *   Extract `paymentIntentId` from `invoice.payment_intent`.
    *   Look up `PendingOrderContext` record by `paymentIntentId`.
    *   If found:
        *   Parse `cartDetails`.
        *   Create `Order` record, linking `userId` and `subscriptionId` (from `invoice.subscription`).
        *   Create `OrderItem` records based on parsed `cartDetails`.
        *   Delete `PendingOrderContext` record.
    *   Add logging and error handling.
5.  **Webhook Handler (`customer.subscription.updated`):**
    *   Extract `subscription` object.
    *   Attempt to find local `Subscription` by `stripeSubscriptionId`.
    *   If found: Update `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, etc.
    *   If not found: Check if `subscription.status` is activating (`active`, `trialing`). If yes, extract necessary details (including `userId` from metadata) and create the local `Subscription` record.
    *   Add logging and error handling.
6.  **Webhook Handler (`customer.subscription.created`):**
    *   Add basic handling (logging is sufficient for now) as this event fires before activation in this flow.
7.  **Testing:**
    *   Test checkout with only subscription items.
    *   Test checkout with only one-time items (ensure this still works correctly, may need adjustments if the endpoint is fully refactored).
    *   Test checkout with mixed subscription and one-time items.
    *   Verify `Order`, `OrderItem`, and `Subscription` records are created correctly in the database.
    *   Verify `Subscription` status becomes `active` and `currentPeriodEnd` is populated.
    *   Verify temporary context is deleted.
    *   Verify renewal flow (`invoice.paid` for subsequent invoices) still works.

## Future Considerations

*   Handle potential race conditions more explicitly (e.g., ensuring `invoice.paid` doesn't create duplicate orders if another event somehow triggered creation first).
*   Consider database transactions for webhook operations involving multiple model updates/creations.
*   Refine error handling and potential user notifications for failures. 