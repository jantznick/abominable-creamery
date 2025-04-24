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

## Priority 2: Enhancements & Refinements

*   **UI/UX Improvements:**
    *   [ ] Implement responsive design thoroughly across all pages.
    *   [ ] Add loading indicators and skeletons for better perceived performance.
    *   [ ] Refine forms (Contact, Checkout) with validation and user feedback.
    *   [ ] Improve image handling (optimization, lazy loading).
*   **Error Handling:**
    *   [ ] Improve global error handling (e.g., implement the `NotFound` page properly for invalid routes/API calls).
    *   [ ] Add more robust error boundaries in React.

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