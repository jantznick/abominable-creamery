# Development Tasks

## Active Tasks

### Checkout Flow Enhancements

-   **Frontend:**
    -   [x] Integrate saved payment method dropdown.
    -   [x] Add "Save this card" checkbox for logged-in users using a new card (non-subscription).
    -   [x] Display notification about saving card for subscriptions.
    -   [x] Fix conditional rendering logic in the payment section.
-   **Backend:**
    -   [ ] Modify `/api/stripe/initiate-checkout` to handle `selectedCardId` for paying with a saved card.
    -   [ ] Modify `/api/stripe/initiate-checkout` to handle `saveNewCardForFuture` flag and subscriptions (create SetupIntent).
    -   [ ] Modify Stripe webhook handler (`/api/stripe/webhook`) to attach newly saved payment methods to customers based on `setup_intent.succeeded` and `saveNewCardForFuture` metadata.
    -   [ ] Modify Stripe webhook handler to correctly process orders paid with saved cards.
    -   [ ] Ensure `checkout_attempt` schema and logic correctly store/use `selectedCardId` and `saveNewCardForFuture`.
