# Implementation Plan: Authentication & Order Persistence

This document outlines the steps to implement user authentication, order persistence with guest checkout support, and basic admin order viewing.

**Status Key:** ✅=Complete, 🚧=In Progress, ❌=Not Started / Blocked

## Phase 1: Database Setup & Prisma

*   ✅ **1. Install Dependencies:** `prisma`, `@prisma/client`, `pg`, `@types/pg`
*   ✅ **2. Initialize Prisma:** `npx prisma init`
*   ✅ **3. Define Schema (`prisma/schema.prisma`):** Models and enums defined.
*   ✅ **4. Run Initial Migration:** `npx prisma migrate dev` successful.
*   ✅ **5. Generate Prisma Client:** Completed via `migrate dev`.

## Phase 2: Backend API (Authentication)

*   ✅ **6. Install Dependencies:** `bcrypt`, `express-session`, `connect-pg-simple`, types.
*   ✅ **7. Setup Session Middleware (`serverRender.tsx`):** Configured `express-session` with `connect-pg-simple` store.
*   ✅ **8. Create Prisma Client Instance (`serverRender.tsx`):** Instantiated.
*   🚧 **9. Implement Auth Routes (`src/server/routes/auth.ts`):** Code exists but is reported as faulty/incomplete and needs rewrite. Linter errors related to mounting also present.
    *   `POST /api/auth/signup`
    *   `POST /api/auth/login`
    *   `POST /api/auth/logout`
    *   `GET /api/auth/me`

## Phase 3: Frontend (Authentication UI)

*   ✅ **10. Create Auth Context (`src/context/AuthContext.tsx`)**
*   ✅ **11. Wrap App with AuthProvider**
*   ✅ **12. Create Auth Modals:** `LoginModal.tsx`, `SignupModal.tsx` (Replaced pages with modals)
*   N/A **13. Add Routes:** `/login`, `/signup` (Not needed with modal approach)
*   ✅ **14. Update Header** (Will need state/logic to open modals)
*   ✅ **15. Protected Routes (Optional)** (Added /profile route)
*   ✅ **16. Modify Checkout Start** (Added guest/login choice step)

## Phase 4: Backend API & Frontend (Order Management)

*   ✅ **17. Implement Order Routes** (Created placeholder file `orders.ts` and mounted router)
*   🚧 **18. Modify Order Confirmation Flow**
    *   ✅ Create backend endpoint `GET /api/stripe/payment-intent/:paymentIntentId`.
    *   ✅ Update `OrderConfirmation.tsx` frontend to get `payment_intent` from URL, call backend endpoint.
    *   ✅ Implement `POST /api/orders` logic in `orders.ts`.
    *   ✅ Integrate order creation API call into `OrderConfirmation.tsx` logic (on successful payment).
    *   ✅ Add cart clearing (`clearCart()`) to `OrderConfirmation.tsx` on successful order creation.
*   ❌ **19. Create User Profile Page** (Implement actual data fetching/display in `Profile.tsx` for users)
*   ❌ **20. Create Admin Orders Page** (Implement actual data fetching/display in `Profile.tsx` for admins)

## Phase 5: Refinements

*   ❌ ...

*   Implement robust server-side validation for all API inputs.
*   Add more detailed error handling.
*   Consider password reset functionality.
*   Refine guest checkout UI/UX (e.g., prompting to create account post-checkout).
*   Implement admin UI for updating order status (e.g., to SHIPPED). 