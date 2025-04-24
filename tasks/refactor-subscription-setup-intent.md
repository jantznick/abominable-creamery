# Task: Refactor Subscription Flow using Setup Intents

**Status:** Not Started

**Goal:** Modify the checkout process to use Stripe Setup Intents for subscription checkouts. This defers the actual creation of the Stripe Subscription object until *after* the user's payment method is successfully confirmed, aligning with the requirement to only create the subscription upon final payment submission while still working correctly with Stripe Elements.

**Related Features:**
*   [feature-subscriptions.md](./feature-subscriptions.md)
*   [feature-stripe-products.md](./feature-stripe-products.md)
*   Supersedes: [refactor-subscription-creation.md](./refactor-subscription-creation.md) (Previous approach)

## Background

The previous attempts involved creating the Stripe Subscription object *before* payment confirmation, which either caused timing issues with payment intent expansion or didn't align with the user requirement of creating the subscription only upon successful payment. Using a Setup Intent allows us to capture and verify payment details first, then create the subscription using those confirmed details via a webhook.

## Acceptance Criteria

1.  When a user navigates to the payment step of checkout:
    *   The frontend calls a backend endpoint (`/api/stripe/initiate-checkout`).
    *   **If the cart contains subscription items:**
        *   The backend finds/creates a Stripe Customer.
        *   The backend creates a Stripe **Setup Intent** for the customer (`usage: 'on_session'`).
        *   Cart details, user ID, and other necessary context are stored in the Setup Intent's **metadata**.
        *   The backend returns the Setup Intent's `client_secret`.
    *   **If the cart contains only one-time items:**
        *   The backend creates a Stripe **Payment Intent**.
        *   Cart details, user ID, etc., are stored in the Payment Intent's **metadata**.
        *   The backend returns the Payment Intent's `client_secret`.
2.  The frontend uses the received `clientSecret` to render the Stripe Payment Element.
3.  User clicks "Pay now" / submits the payment form.
4.  Frontend calls `stripe.confirmPayment()` (for Payment Intents) or `stripe.confirmSetup()` (for Setup Intents).
5.  **If `setup_intent.succeeded` webhook is received:**
    *   The backend retrieves the Setup Intent object.
    *   It extracts the `customerId`, `payment_method` ID, and the context from the metadata.
    *   It **calls `stripe.subscriptions.create`** using the `customerId`, context items, and `default_payment_method`.
    *   It creates the local `Order`, `OrderItem`, and `Subscription` records using the context from the metadata.
6.  **If `payment_intent.succeeded` webhook is received:**
    *   The backend retrieves the Payment Intent object.
    *   It extracts context from the metadata.
    *   It creates the local `Order` and `OrderItem` records (for one-time purchases).
7.  Subsequent webhooks (`invoice.paid`, `customer.subscription.updated`) update the local `Subscription` status/details as needed (especially for renewals).
8.  The local `Subscription` record is created only *after* successful payment setup and reflects the correct status.
9.  The `PendingOrderContext` model and related logic are removed.

## Implementation Steps

1.  **Schema:** Remove the `PendingOrderContext` model from `prisma/schema.prisma`. Run `npx prisma generate` and `npx prisma migrate dev --name remove_pending_order_context`.
2.  **API Endpoint (Checkout Initiation):**
    *   Rename `POST /api/stripe/create-payment-intent` to `POST /api/stripe/initiate-checkout` (update frontend calls accordingly).
    *   Refactor the endpoint logic:
        *   Keep validation, cart parsing, `containsSubscription` check.
        *   **If `containsSubscription`:**
            *   Find/create Stripe Customer.
            *   Prepare comprehensive metadata (stringified cart details, user ID, contact/shipping info if needed). Ensure metadata size limits are respected.
            *   Create **Setup Intent** with `customer`, `usage: 'on_session'`, and `metadata`.
            *   Return `{ clientSecret: setupIntent.client_secret }`.
        *   **Else (one-time only):**
            *   Prepare metadata.
            *   Create **Payment Intent** with `amount`, `currency`, `metadata`.
            *   Return `{ clientSecret: paymentIntent.client_secret }`.
        *   **Remove all `stripe.subscriptions.create` calls from this endpoint.**
    *   Add robust error handling.
3.  **Webhook Handler (`setup_intent.succeeded`):**
    *   Add a new `case` for this event.
    *   Retrieve the `SetupIntent` object: `event.data.object`.
    *   Extract `customerId`, `payment_method` ID, and parse context from `metadata`.
    *   Validate extracted data.
    *   Call `stripe.subscriptions.create` using the customer, payment method, and items derived from metadata. Include `userId` in subscription metadata if possible. Handle potential one-time items by adding them via `add_invoice_items`. Use `payment_behavior: 'allow_incomplete'` or rely on default behavior now that payment method is confirmed.
    *   Create local `Order`, `OrderItem`, and `Subscription` records in a transaction.
    *   Add logging and error handling.
4.  **Webhook Handler (`payment_intent.succeeded`):**
    *   Refine this handler to *only* process Payment Intents intended for one-time purchases. It might need to check metadata to confirm it wasn't created by an `invoice.paid` event (if that flow remains for renewals).
    *   Create `Order` and `OrderItems` using metadata.
5.  **Webhook Handler (`invoice.paid`):**
    *   Refactor this handler to primarily focus on *renewals*. It should update the local `Subscription`'s `currentPeriodEnd` and `status`, and create the renewal `Order` record.
    *   Remove logic related to `PendingOrderContext`.
6.  **Webhook Handler (`customer.subscription.updated`):**
    *   Keep logic to update local `Subscription` status and details based on the event. Remove the fallback creation logic (creation now happens definitively in `setup_intent.succeeded`).
7.  **Webhook Handler (`customer.subscription.created`):**
    *   Keep basic logging; no critical action needed here anymore.
8.  **Frontend (`Checkout.tsx`):**
    *   Update the API endpoint URL from `/create-payment-intent` to `/initiate-checkout`.
    *   Update the `handleSubmit` function in `StripeCheckoutForm` to call `stripe.confirmSetup()` if the `clientSecret` pattern indicates it's from a Setup Intent (usually starts with `seti_...`), otherwise call `stripe.confirmPayment()` (usually starts `pi_...`).
9.  **Testing:**
    *   Test checkout with subscriptions only (verify Setup Intent flow, webhook creation).
    *   Test checkout with one-time items only (verify Payment Intent flow).
    *   Test checkout with mixed items (verify Setup Intent flow with `add_invoice_items`).
    *   Verify database records (`Order`, `OrderItem`, `Subscription`) are created correctly *after* payment confirmation.
    *   Verify subscription becomes `active`.
    *   Test renewals.

## Future Considerations

*   Consolidate metadata structure used across Setup Intents and Payment Intents.
*   Refine error handling and user feedback loops.
*   Ensure idempotency in webhook handlers. 