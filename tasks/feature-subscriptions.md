# Feature: Subscription Purchasing

**Status:** Partially Implemented / Planned

## 1. Overview

This feature allows users to subscribe to receive recurring deliveries of ice cream flavors. The initial frontend work on the product page (`Flavor.tsx`) is complete, allowing users to select a subscription option via a checkbox. This plan outlines the remaining tasks to fully integrate subscriptions into the cart, checkout, and backend systems **using Stripe Payment Intents and the Payment Element**. **It includes creating new Order records for each successful subscription renewal.**

## 2. Key Features & Goals

*   **Product Page:** Allow users to choose between one-time purchase and "Subscribe & Save" for eligible products. (Done)
*   **Cart:** Visually distinguish subscription items from one-time purchases, showing the recurring interval (e.g., "monthly").
*   **Checkout:** Handle carts containing both one-time items and subscription items using the existing embedded Payment Element flow.
*   **Backend:** Securely create Stripe Payment Intents, handling potential subscriptions by setting `setup_future_usage`. Manually create Stripe Subscriptions after successful payment confirmation via webhooks. **Create new local Order records upon successful subscription renewal.**
*   **Database:** Store subscription details (Stripe IDs, status, interval, linked user) locally. **Link renewal Orders back to Subscriptions.**
*   **Webhooks:** Process `payment_intent.succeeded` (for initial order/sub creation) and `invoice.paid` (for renewal order creation).

## 3. Technical Approach

*   **Data Model:**
    *   Use Stripe Products and Prices.
    *   One-time Prices eligible for subscription will have `metadata.subscriptionId` pointing to the corresponding recurring Stripe Price ID.
    *   Recurring Stripe Prices will have `recurring.interval` set (e.g., 'month').
*   **Checkout:**
    *   Utilize **Stripe Payment Intents API** with the embedded **Payment Element** on the frontend.
    *   The frontend checkout flow (`Checkout.tsx`) remains largely the same UI-wise.
    *   When the user reaches the payment step, the backend's `/api/stripe/create-payment-intent` endpoint will be called.
    *   If the cart contains *any* subscription item, the Payment Intent must be created with `setup_future_usage: 'on_session'` to save the payment method for the recurring charge.
    *   A Stripe Customer should be created or retrieved (using email) and associated with the Payment Intent (`customer: customerId`). This is necessary for saving payment methods and creating subscriptions.
    *   The backend returns the `clientSecret` of the Payment Intent to the frontend.
    *   The frontend uses the `clientSecret` to confirm the payment via the Payment Element (`stripe.confirmPayment`).
*   **Backend Subscription Creation & Persistence:**
    *   A new `Subscription` table will be added to the database (`prisma/schema.prisma`). (Done)
    *   An optional `subscriptionId` field will be added to the `Order` model to link renewal orders.
    *   **`payment_intent.succeeded` Webhook:**
        *   Checks metadata.
        *   Creates initial `Order` and `OrderItem` records.
        *   If subscription present, creates Stripe `Subscription` and local `Subscription` record.
        *   Optionally links the *initial* `Order` to the `Subscription` via `order.subscriptionId`.
    *   **`invoice.paid` Webhook:**
        *   Checks if `invoice.billing_reason` is `subscription_cycle` or similar.
        *   Checks if `invoice.subscription` exists.
        *   If yes (it's a successful renewal payment):
            *   Retrieves the associated local `Subscription` record.
            *   Creates a **new** `Order` record (status `PAID` or similar) linked to the user and the `Subscription` (`order.subscriptionId`).
            *   Creates corresponding `OrderItem`s based on the subscription.
            *   Updates the `currentPeriodEnd` on the local `Subscription` record.
*   **Frontend State:**
    *   `CartContext` stores `isSubscription` and `recurringInterval` flags. (Done)

## 4. Database Schema Changes (`prisma/schema.prisma`)

*   **Add `Subscription` model:** (Done)
    ```prisma
    model Subscription {
      id                  String      @id @default(cuid())
      userId              Int
      user                User        @relation(fields: [userId], references: [id])
      stripeSubscriptionId String      @unique
      stripePriceId       String
      status              String
      interval            String
      currentPeriodEnd    DateTime
      cancelAtPeriodEnd   Boolean     @default(false)
      createdAt           DateTime    @default(now())
      updatedAt           DateTime    @updatedAt

      @@index([userId])
    }
    ```
*   **Add relation to `User` model:** (Done)
    ```prisma
    model User {
      // ... other fields
      subscriptions Subscription[]
    }
    ```
*   **Consider adding Stripe Customer ID to `User` model:** Add `stripeCustomerId String? @unique` to facilitate retrieving customers.
*   **Add `stripeCustomerId` to `User` model:** (Done)
*   **Add Optional `subscriptionId` to `Order` model:**
    ```prisma
    model Order {
      // ... other fields
      subscriptionId String?     // Link to the Subscription if this is a renewal order
      subscription   Subscription? @relation(fields: [subscriptionId], references: [id])
      // Optional: Add index if querying orders by subscriptionId
      // @@index([subscriptionId])
    }
    model Subscription {
      // ... other fields
      renewalOrders Order[]      // Add relation back to renewal Orders
    }
    ```
*   **(Optional) Consider adding `stripeSubscriptionId` to `OrderItem`:** (Done - commented out)

## 5. API Changes

*   **`/api/stripe/create-payment-intent` Endpoint:**
    *   **Enhance (Keep Existing):** Modify this endpoint significantly.
    *   **Functionality:**
        *   Accepts cart items (including subscription flags).
        *   Calculate total amount for the *initial* payment (subscriptions might have free trials or different initial amounts, handle accordingly if applicable - assume standard price for now).
        *   Check if any item `isSubscription`.
        *   **If subscription present:**
            *   Find or create a Stripe Customer based on user email (or session email if guest). Store/update `stripeCustomerId` on local `User` model.
            *   Set `setup_future_usage: 'on_session'` in `paymentIntents.create`.
            *   Pass the `customer: customerId` to `paymentIntents.create`.
        *   Store relevant cart details (including which items are subscriptions and their recurring Price IDs) in the Payment Intent `metadata`. This is crucial for the webhook later.
        *   Creates the Stripe Payment Intent (`stripe.paymentIntents.create`).
        *   Returns the `clientSecret` to the frontend.
*   **`POST /api/webhooks/stripe` Endpoint:**
    *   **Enhance:** Modify handler for `payment_intent.succeeded` (Task 5 - Partially Done - Needs Order Creation Logic).
    *   **Enhance:** **Add handler for `invoice.paid`** (New part of Task 5).
    *   **`invoice.paid` Functionality:**
        *   Verify signature.
        *   Check `invoice.billing_reason`, `invoice.subscription`, `invoice.paid`.
        *   Retrieve local `Subscription`.
        *   Create new `Order` and `OrderItem`s, linking to the `Subscription`.
        *   Update local `Subscription.currentPeriodEnd`.
        *   Handle errors.

## 6. Frontend Changes

*   **`src/pages/Cart.tsx`:**
    *   Update item rendering to check `item.isSubscription`. (Task 6 Complete)
    *   If true, display "(Subscription)" and the `item.recurringInterval`.
    *   Ensure "Proceed to Checkout" button works with the existing flow (passing cart items).
*   **`src/pages/Checkout.tsx`:**
    *   Continue using the Payment Element.
    *   Ensure it correctly calls the *enhanced* `/api/stripe/create-payment-intent` endpoint.
    *   Handle the `clientSecret` returned and use `stripe.confirmPayment` as before.
*   **`src/pages/OrderConfirmation.tsx`:**
    *   Logic likely remains similar, confirming `paymentIntent` status using the ID from the URL redirect after `stripe.confirmPayment`. (Verify this flow).
*   **(New) `src/pages/Admin/OrdersView.tsx` (or similar):**
    *   No immediate change *required*, renewal orders will appear.
    *   **Enhancement (Future Task):** Optionally display the linked `subscriptionId` or visually distinguish renewal orders.
*   **(New) `src/pages/Admin/SubscriptionsView.tsx` (or similar):**
    *   **New Feature (Future Task):** Create a new view to list and manage `Subscription` records from the database.

## 7. Tasks (Revised)

*   **Task 1 (Backend):** Define `Subscription` model in `prisma/schema.prisma` and add relation to `User`. (Done)
*   **Task 2 (Backend):** Run `npx prisma migrate dev` to apply schema changes. (Done)
*   **Task 3 (Backend):** Add `stripeCustomerId` field to `User` model in `prisma/schema.prisma` and migrate.
*   **Task 4 (Backend):** Add `subscriptionId` relation to `Order` model and migrate.
*   **Task 5 (Backend):** Enhance `/create-payment-intent`. (Done)
*   **Task 6 (Backend):** Enhance `/webhook` handler:
    *   Implement Order Creation logic within `payment_intent.succeeded`.
    *   **Add `invoice.paid` handler** to create renewal `Order` records and update local `Subscription`.
*   Task 7 (Frontend): Update `Cart.tsx`. (Done)
*   Task 8 (Frontend): Verify `Checkout.tsx`. (Done)
*   Task 9 (Frontend): Verify `OrderConfirmation.tsx`. (Done)
*   **Task 10 (Testing):** Thoroughly test scenarios (including renewals, webhook processing for renewals, renewal order creation).
*   **(Future) Task 11 (Admin):** Enhance Admin Order View to show subscription links.
*   **(Future) Task 12 (Admin):** Create dedicated Admin Subscription Management View.

## 8. Future Considerations

*   User account page to view/manage active subscriptions (cancel, update payment method via Stripe Customer Portal).
*   Handling other Stripe subscription webhooks (e.g., `invoice.payment_failed`, `customer.subscription.deleted`) to update local `Subscription` status.
*   More robust error handling and retry mechanisms for webhook processing.
*   (Same as before + Admin Views) 