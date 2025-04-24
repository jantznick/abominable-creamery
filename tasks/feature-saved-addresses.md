# Implementation Plan: Saved Addresses for User Profiles

This document outlines the steps to implement the ability for logged-in users to save and reuse shipping/billing addresses.

**Status Key:** ✅=Complete, 🚧=In Progress, ❌=Not Started / Blocked

## Phase 1: Database Schema Update

*   ❌ **1. Define Address Model (`prisma/schema.prisma`):**
    *   Create a new `Address` model.
    *   Fields should include: `id`, `userId` (relation to `User`), `type` (e.g., ENUM 'SHIPPING', 'BILLING'), `streetAddress`, `city`, `state`, `postalCode`, `country`, `isDefault` (Boolean), `createdAt`, `updatedAt`.
    *   Establish a one-to-many relationship between `User` and `Address`.
*   ❌ **2. Run Prisma Migration:**
    *   Generate a new migration: `npx prisma migrate dev --name add-address-model`
    *   Verify the migration script and apply it.
*   ❌ **3. Generate Prisma Client:** Ensure the client is updated automatically by `migrate dev`.

## Phase 2: Backend API (Address Management)

*   ❌ **4. Create Address API Routes (`src/server/routes/addresses.ts`):**
    *   Create a new router file for address-related endpoints.
    *   Implement middleware to ensure only logged-in users can access these routes (check `req.session.user`).
*   ❌ **5. Implement CRUD Endpoints:**
    *   🚧 `GET /api/addresses`: Fetch all addresses for the logged-in user.
    *   🚧 `POST /api/addresses`: Create a new address for the logged-in user. Include validation.
    *   🚧 `PUT /api/addresses/:addressId`: Update an existing address. Ensure the address belongs to the logged-in user.
    *   🚧 `DELETE /api/addresses/:addressId`: Delete an address. Ensure the address belongs to the logged-in user.
    *   🚧 `PUT /api/addresses/:addressId/default`: Set an address as the default (potentially unset others). Ensure ownership.
*   ✅ **6. Mount Address Router (`serverRender.tsx`):** Mount the new address router under `/api/addresses`.

## Phase 3: Frontend (Profile UI - Address Management)

*   ✅ **7. Create Address Management Component (`src/components/profile/AddressManager.tsx`):**
    *   Component to display a list of saved addresses.
    *   Include forms/buttons for adding, editing, and deleting addresses.
    *   Fetch addresses using the `GET /api/addresses` endpoint.
    *   Implement logic to call `POST`, `PUT`, `DELETE` endpoints.
    *   Add functionality to set an address as default.
*   ✅ **8. Integrate into User Profile Page (`src/pages/Profile.tsx` / `src/components/profile/UserProfileView.tsx`):**
    *   Add a section to the user profile view to render the `AddressManager` component.

## Phase 4: Frontend (Checkout Integration)

*   ✅ **9. Modify Checkout Component (`src/pages/Checkout.tsx` or relevant sub-components):**
    *   In the Shipping/Billing address sections, fetch the user's saved addresses (`GET /api/addresses`).
    *   Provide an option to select a saved address (e.g., dropdown or list).
    *   Pre-fill the form if a saved address is selected.
    *   Allow entering a new address as usual.
    *   ✅ **(Optional)** Add a checkbox "Save this address for future use" when entering a new address, which triggers `POST /api/addresses` (via Order Confirmation).
*   ✅ **10. Update Order Creation Logic:**
    *   Modify the data sent to `POST /api/orders`.
    *   If a saved address was selected, potentially send the `addressId`.
    *   If a new address was entered, send the full address details as currently implemented.
    *   The backend (`POST /api/orders` in `src/server/routes/orders.ts`) needs to handle both cases (receiving full address details vs. an `addressId` to look up).

## Phase 5: Refinements & Considerations

*   ❌ **11. Address Validation:** Implement robust server-side and client-side validation for address fields.
*   ❌ **12. UI/UX:** Ensure a smooth user experience for selecting, adding, and managing addresses in both profile and checkout.
*   ❌ **13. Billing vs. Shipping:** Clarify if separate billing/shipping addresses are needed or if one address serves both purposes initially. Adjust schema and UI accordingly.
*   ❌ **14. Default Address Logic:** Decide how the "default" address should be used (e.g., pre-select in checkout).
*   ❌ **15. Testing:** Add tests for API endpoints and frontend components. 