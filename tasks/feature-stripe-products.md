# Implementation Plan: Stripe Product Integration

This document outlines the steps to replace the static product data in `src/utils/content.ts` with dynamic product data fetched from Stripe.

**Status Key:** ✅=Complete, 🚧=In Progress, ❌=Not Started / Blocked

## Phase 1: Stripe Setup & Configuration

*   ✅ **1. Define Metadata Structure:** Finalize the list of required metadata fields for Stripe Products (e.g., `simpleName`, `hasDairy`, `hasEgg`, `withoutDairy`, `withoutEgg`, image mapping strategy).
*   ❌ **2. Create Products in Stripe:** Set up each ice cream flavor as an active `Product` in the Stripe Dashboard (Test Mode).
*   ❌ **3. Add Metadata to Products:** Populate the defined metadata fields for each Stripe Product.
*   ❌ **4. Upload Images to Products:** Attach appropriate images to each Stripe Product.
*   ❌ **5. Create Prices:** Create and attach a default `Price` object (with the correct currency and amount) to each Stripe Product. Note the Price IDs.

## Phase 2: Backend Implementation

*   ✅ **6. Create Server Utility:** Implement a function (`src/server/utils/stripeProducts.ts` - TBC) to fetch active products (`stripe.products.list`) with their default prices expanded.
*   ✅ **7. Implement Data Mapping:** Add logic within the server utility to transform Stripe `Product` and `Price` objects (including metadata and images) into the application's `Flavor` data structure. Define the `Flavor` type explicitly if not already done.
*   ✅ **8. Integrate into SSR:** Modify `serverRender.tsx` to call the new utility function during request handling.
*   ✅ **9. Inject Data into Frontend:** Pass the fetched/mapped product list to the initial React render (e.g., via props to `<App>` or through a new `ProductContext`).
*   ✅ **10. Update Checkout Endpoint:** Modify the `POST /create-payment-intent` endpoint. Instead of trusting the amount from the client, it should accept a list of Price IDs and quantities, fetch the corresponding prices from Stripe using the secret key, calculate the total server-side, and then create the PaymentIntent.

## Phase 3: Frontend Implementation

*   ✅ **11. Create Product Context (Optional):** If using Context, create `src/context/ProductContext.tsx`. Wrap the application with its provider in `serverRender.tsx` (for SSR) and potentially `clientRender.tsx` (though data should come from SSR).
*   ✅ **12. Refactor `Flavors.tsx`:** Update the main flavors page to consume product data from props or `ProductContext` instead of `src/utils/content.ts`.
*   ✅ **13. Refactor Other Consumers:** Identify and refactor any other components using the static `flavors` data (e.g., search functionality, individual product display if separate).
*   ✅ **14. Update `CartContext`:** Modify the cart state and logic to store Stripe Price IDs instead of the old product IDs/structure. Ensure quantities are handled correctly. Update functions like `addToCart`, `removeFromCart`, `getCartTotal` (the latter might rely more on backend calculation now or need Price data).
*   ✅ **15. Update Checkout UI (`Checkout.tsx`):** Modify the checkout component to pass Price IDs and quantities to the `/create-payment-intent` endpoint.
*   ✅ **16. Remove Static Data:** Once all usages are refactored, remove the `flavors` array and related unused code from `src/utils/content.ts`.

## Phase 4: Testing & Refinement

*   ❌ **17. Test SSR:** Verify that product data is correctly rendered on initial page load for pages like `/flavors`.
*   ❌ **18. Test Client-Side Navigation:** Ensure pages still work correctly when navigated to client-side.
*   ❌ **19. Test Cart Functionality:** Test adding/removing items, quantity changes, and cart total display (if still calculated client-side).
*   ❌ **20. Test Checkout Flow:** Perform end-to-end checkout tests using Stripe Test Mode to ensure correct PaymentIntent creation and order processing based on Stripe Price IDs.
*   ❌ **21. Review Error Handling:** Add appropriate error handling for Stripe API calls and data fetching/mapping.
*   ❌ **22. Update Documentation:** Add the new section to `docs/technical.md` (as drafted above) and update `README.md` or other relevant docs if necessary. 