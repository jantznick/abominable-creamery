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

## Potential Future Refinements

### Checkout State Management (`src/pages/Checkout.tsx`)
- **Description:** The main `Checkout.tsx` component currently manages most of the state for the multi-step checkout form (contact info, shipping address, payment details, section progression) and passes it down via props to the section components (`ContactSection`, `ShippingSection`, `PaymentSection`). My preference would be to use built in react useReducer.
- **Potential Improvement:** While functional, this leads to significant prop drilling. Explore moving state management *into* the respective section components where appropriate.
- **Considerations:** This would require implementing mechanisms to lift necessary state back up to `Checkout.tsx` (e.g., for the final API call) or adopting a shared state management solution (like React Context with `useReducer`, Zustand, etc.) to handle state needed across different sections or between the parent and children.
- **Trade-offs:** Weigh the benefit of reduced prop drilling against the added complexity of state lifting patterns or introducing a state management library.
