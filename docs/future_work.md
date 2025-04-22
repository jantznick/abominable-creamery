# Future Work & Development Roadmap

This document outlines the necessary steps and future work required to transform the Abominable Creamery website into a fully functional online ice cream shop.

## Priority 1: Core Functionality

1.  **Database Setup (Prisma):**
    *   [ ] Database provider is Postgres, we should always use a ORM.
    *   [ ] Create `prisma/schema.prisma`.
    *   [ ] Define initial data models:
        *   `Flavor` (name, description, imageURL, price, ingredients, allergens, stock status/quantity).
        *   `User` (for potential future accounts/order history).
        *   `Order` (userId, orderDate, totalAmount, status, shippingAddress).
        *   `OrderItem` (orderId, flavorId, quantity, priceAtPurchase).
        *   (Consider others: `Cart`, `CartItem` if storing carts server-side, `Category`).
    *   [ ] Configure `DATABASE_URL` in `.env`.
    *   [ ] Run `npx prisma migrate dev --name init` to create the initial database schema.
    *   [ ] (Optional) Create seed data (`prisma/seed.ts` or similar) for flavors and run `npx prisma db seed`.

2.  **Backend API Endpoints (Express):**
    *   [ ] Create a dedicated routing structure for API endpoints (e.g., `src/api/routes/flavors.ts`, `src/api/routes/cart.ts`, `src/api/routes/orders.ts`).
    *   [ ] Mount these API routes in `serverRender.tsx` (or a dedicated server setup file) under a prefix like `/api`.
    *   [ ] Implement CRUD endpoints for flavors (`GET /api/flavors`, `GET /api/flavors/:id`).
    *   [ ] Implement endpoints for cart management (e.g., `GET /api/cart`, `POST /api/cart`, `DELETE /api/cart/item/:itemId`).
    *   [ ] Implement endpoints for order creation (`POST /api/orders`).

3.  **Frontend Data Fetching:**
    *   [ ] Update frontend pages (`Flavors`, `Flavor`, `Cart`) to fetch data from the new API endpoints (using `fetch` or a library like `axios`).
    *   [ ] Handle loading and error states during data fetching.

4.  **Shopping Cart (React Context):**
    *   [ ] Create a `CartContext` (`src/context/CartContext.tsx`).
    *   [ ] Define cart state (e.g., `items: [{ flavor: Flavor, quantity: number }]`).
    *   [ ] Implement context provider with functions to add item, remove item, update quantity, clear cart.
    *   [ ] Wrap the application (likely in `src/routes/index.tsx`) with the `CartProvider`.
    *   [ ] Update `Header` component to display cart item count using `useContext(CartContext)`.
    *   [ ] Update `Flavor` page to add items to the cart.
    *   [ ] Implement the `Cart` page (`src/pages/Cart.tsx`) to display items, allow quantity changes/removals, show total price, and link to checkout.

5.  **Stripe Integration (Checkout):**
    *   [ ] Configure Stripe elements on the frontend (`Cart` page or a dedicated `Checkout` page) using `@stripe/react-stripe-js`.
    *   [ ] Create a backend endpoint (`POST /api/create-payment-intent`) that takes cart details, calculates the total amount, and creates a Stripe PaymentIntent, returning the `clientSecret`.
    *   [ ] On the frontend, use the `clientSecret` to confirm the payment with Stripe.
    *   [ ] Upon successful payment confirmation from Stripe (client-side or via webhook), create the order in the database using the `/api/orders` endpoint.
    *   [ ] Handle payment failures and provide user feedback.
    *   [ ] Set up Stripe webhooks (`POST /api/stripe-webhooks`) to handle asynchronous events (e.g., payment success, disputes) reliably and update order status in the database. Ensure webhook secrets are stored securely in `.env`.

## Priority 2: Enhancements & Refinements

*   **UI/UX Improvements:**
    *   [ ] Implement responsive design thoroughly across all pages.
    *   [ ] Add loading indicators and skeletons for better perceived performance.
    *   [ ] Refine forms (Contact, Checkout) with validation and user feedback.
    *   [ ] Implement the Dribbble design more faithfully (https://dribbble.com/shots/22483806-Ice-Cream-Shop-Website).
    *   [ ] Improve image handling (optimization, lazy loading).
*   **Search Functionality:**
    *   [ ] Implement the `Search` page logic, potentially using `fuzzysort` against flavor data fetched from the API.
*   **Content Management:**
    *   [ ] Move static content (like `siteData` in `src/utils/content.ts`) potentially into the database or a headless CMS for easier updates.
*   **Error Handling:**
    *   [ ] Improve global error handling (e.g., implement the `NotFound` page properly for invalid routes/API calls).
    *   [ ] Add more robust error boundaries in React.
*   **Testing:**
    *   [ ] Set up a testing framework (e.g., Jest, React Testing Library).
    *   [ ] Add unit tests for critical components, utils, and API logic.
    *   [ ] Add integration tests for user flows (e.g., adding to cart, checkout).

## Priority 3: Production Readiness

*   **Security:**
    *   [ ] Add input validation and sanitization to all API endpoints.
    *   [ ] Implement rate limiting for API endpoints.
    *   [ ] Ensure proper handling of secrets (`.env`).
    *   [ ] Review dependencies for known vulnerabilities.
*   **Performance:**
    *   [ ] Analyze Webpack bundle size and optimize.
    *   [ ] Optimize database queries.
    *   [ ] Implement caching strategies (backend and frontend).
*   **Deployment:**
    *   [ ] Choose a hosting provider (e.g., Vercel, Netlify, Heroku, Render, AWS).
    *   [ ] Set up CI/CD pipeline for automated testing and deployment.
    *   [ ] Configure production environment variables.
*   **Monitoring & Logging:**
    *   [ ] Integrate a logging service (e.g., Sentry, LogRocket) for error tracking and performance monitoring.

## General Instructions & Cleanup

*   **Follow Project Rules:** Adhere to the guidelines in `rules.mdc` (if it exists or is created). Prioritize simplicity, iteration, and quality.
*   **Code Style:** Ensure all code conforms to ESLint/Prettier rules (if configured). Maintain consistency.
*   **Refactoring:** Actively look for opportunities to refactor and simplify code, especially as new features are added. Keep components small and focused.
*   **Documentation:** Keep `docs/technical.md` updated as the architecture evolves. Document complex logic or non-obvious decisions in code comments or separate markdown files if necessary.
*   **Dependencies:** Regularly review and update dependencies. 