# Abominable Creamery - Technical Documentation

## 1. Overview

This document outlines the technical stack, architecture, and operational flow of the Abominable Creamery website project. The goal is to provide a comprehensive guide for developers maintaining and extending the codebase.

The project is a web application for an ice cream shop, built using Node.js, React, and TypeScript, featuring server-side rendering (SSR). It is currently under development, with database integration (Prisma) and API endpoints yet to be implemented. Payment integration via Stripe is planned.

## 2. Tech Stack

### 2.1. Core Technologies

*   **Runtime Environment:** Node.js
*   **Primary Language:** TypeScript
*   **Package Manager:** npm

### 2.2. Backend

*   **Framework:** Express.js - Used to handle HTTP requests, serve static assets, and perform server-side rendering.
*   **Database ORM:** Prisma - Intended for managing database interactions, migrations, and type safety.
    *   **Database Provider:** **Not yet configured.** A `prisma/schema.prisma` file needs to be created and a database provider (e.g., PostgreSQL, MySQL, SQLite) chosen.
*   **Server-Side Rendering:** Implemented using `react-dom/server` (`renderToString`) and `react-router-dom/server` (`StaticRouter`) within an Express route handler (`serverRender.tsx`).

### 2.3. Frontend

*   **Framework:** React v18 (`react`, `react-dom`)
*   **Routing:** React Router v6 (`react-router-dom`) - Handles client-side navigation and defines application routes (`src/routes/index.tsx`).
*   **State Management:** React Context API is the intended approach for managing shared state (e.g., shopping cart). No external state management libraries are currently in use.
*   **Styling:** Tailwind CSS v3 (`tailwindcss`) - Utility-first CSS framework for styling components. Base configuration is in `tailwind.config.js`, input CSS is `src/styles/style.css`, outputting to `public/css/style.css`.
*   **UI Components:** Organized within `src/components/` (reusable) and `src/pages/` (route-level).
*   **Utility:** `classnames` - Used for conditionally joining CSS class names. `fuzzysort` is available for fuzzy searching capabilities.

### 2.4. Build & Development Tools

*   **Bundler:** Webpack v5 (`webpack`, `webpack-cli`) - Bundles JavaScript/TypeScript code, CSS, and other assets for the browser (`webpack.config.js`).
*   **Transpiler:** Babel (`babel-loader`, `babel-preset-react-app`, `.babelrc`) - Used by Webpack to transpile modern JavaScript/JSX features for wider browser compatibility.
*   **TypeScript Compiler:** `tsc` (`typescript`, `tsconfig.json`) - Compiles TypeScript to JavaScript, primarily configured via `tsconfig.json` for type checking and build processes.
*   **Development Server:** `nodemon` - Monitors for file changes and automatically restarts the Node.js/Express server during development.
*   **CSS Watcher:** `tailwindcss --watch` - Monitors CSS files and rebuilds the output CSS during development.

### 2.5. Integrations (Planned)

*   **Payments:** Stripe (`stripe`, `@stripe/react-stripe-js`, `@stripe/stripe-js`) - Dependencies are installed, but integration logic needs implementation.

## 3. Project Structure

*   `/.babelrc`: Babel configuration file.
*   `/.env`: Environment variables (should not be committed). Define database connection strings and Stripe keys here.
*   `/.gitignore`: Specifies intentionally untracked files that Git should ignore.
*   `/built/`: Contains the output of the TypeScript/Webpack build for the server code (`server.js`).
*   `/dist/` / `/static-build/`: Build output directories (confirm usage via `webpack.config.js` if needed).
*   `/node_modules/`: Contains installed npm packages.
*   `/package.json`: Defines project metadata, dependencies, and npm scripts.
*   `/package-lock.json`: Records exact versions of dependencies.
*   `/prisma/`: **(To be created)** Will contain Prisma schema (`schema.prisma`) and migration files.
*   `/public/`: Static assets served directly by Express (CSS, client-side JS bundles, images).
    *   `/css/style.css`: Compiled Tailwind output.
    *   `/js/bundle.js`: Client-side JavaScript bundle from Webpack.
*   `/src/`: Main application source code.
    *   `/components/`: Reusable React components (e.g., Header, Footer).
    *   `/pages/`: Route-level React components (e.g., Home, Flavors, Cart).
    *   `/routes/`: Frontend route definitions (`index.tsx`).
    *   `/styles/`: Source CSS/Tailwind files (`style.css`).
    *   `/utils/`: Utility functions and potentially shared data/content (`content.ts`).
    *   `/App.tsx`: Root React component (currently simple).
*   `/serverRender.tsx`: Express server setup and server-side rendering logic (entry point for server build).
*   `/clientRender.tsx`: Client-side React hydration logic (entry point for the Webpack client bundle).
*   `/tailwind.config.js`: Tailwind CSS configuration.
*   `/tsconfig.json`: TypeScript configuration.
*   `/webpack.config.js`: Webpack configuration.

## 4. Operational Flow

### 4.1. Build Process

*   **Development (`npm start`):** Runs Webpack in watch mode (`build-app`), Tailwind CSS in watch mode (`build-watch-css`), and starts the server with Nodemon (`run-server` executing `built/server.js`).
*   **Production (`npm run build-server-prod`):** Builds Tailwind CSS once and runs Webpack in production mode to create optimized bundles. This is also triggered automatically after `npm install` due to the `postinstall` script.
*   **Output:** Webpack bundles client-side JavaScript into `public/js/bundle.js` and server-side code into `built/server.js`. Tailwind compiles CSS to `public/css/style.css`.

### 4.2. Request Lifecycle (Server-Side Rendering)

1.  Client requests a page URL.
2.  Express server (`serverRender.tsx` -> `built/server.js`) catches the request via `app.get('*')`.
3.  The handler uses `renderToString` with `StaticRouter` (using the request URL) and `AppRoutes` to generate the initial HTML for the requested route.
4.  The server sends the full HTML document, including the rendered React content within `<div id="root">`, links to CSS (`public/css/style.css`), and the client-side JS bundle (`public/js/bundle.js`).
5.  Browser displays the static HTML.
6.  Browser downloads and executes `bundle.js`.
7.  `clientRender.tsx` uses `ReactDOM.hydrateRoot` to attach React to the existing server-rendered DOM (`<div id="root">`), making the page interactive.
8.  Subsequent navigation is handled client-side by React Router.

### 4.3. API Requests (To Be Implemented)

*   Backend API endpoints need to be defined within the Express application.
*   These endpoints will handle operations like:
    *   Fetching product/flavor data (using Prisma).
    *   Managing shopping cart state (potentially interacting with user sessions or database).
    *   Processing orders and payments (using Stripe).
*   These routes should likely be organized separately from the SSR catch-all route (e.g., under an `/api` prefix).

### 4.4. State Management (Planned)

*   Shared client-side state (e.g., shopping cart contents, user information) will be managed using React Context API.
*   Context providers should wrap relevant parts of the application tree, likely within `src/routes/index.tsx` or a higher-level component.

## 5. Key Areas & Conventions

*   **Server Entry Point:** `serverRender.tsx` (compiled to `built/server.js`).
*   **Client Entry Point:** `clientRender.tsx` (bundled into `public/js/bundle.js`).
*   **Routing:** Client-side routes defined in `src/routes/index.tsx` using `react-router-dom`. SSR handled via catch-all in `serverRender.tsx`.
*   **Styling:** Primarily via Tailwind CSS utility classes applied directly in components. Base styles in `src/styles/style.css`.
*   **Data Fetching:** To be implemented via backend API endpoints using Express and Prisma.
*   **Environment Variables:** Managed via `.env` file. Requires `DATABASE_URL` (once Prisma is set up) and Stripe API keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`).

## 6. Setup & Running Locally

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  **Set up Prisma:**
    *   Create `prisma/schema.prisma`. Define datasource (database provider and connection URL) and initial models (e.g., `Flavor`, `Order`).
    *   Create a `.env` file and add the `DATABASE_URL` environment variable corresponding to your chosen database (e.g., `DATABASE_URL="postgresql://user:password@host:port/database"`).
    *   Run initial migration: `npx prisma migrate dev --name init`
4.  **Configure Stripe:** Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to your `.env` file.
5.  **(Optional) Seed Database:** If seeding scripts are created (`prisma.seed`), run `npx prisma db seed`.
6.  Start the development server: `npm start`
7.  Access the application at `http://localhost:3000`. 