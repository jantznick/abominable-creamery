# Feature: Password Reset

## 1. Overview

Implement a secure password reset flow for users who have forgotten their password. This involves allowing users to request a reset link via email, providing a page to set a new password using a unique token, and updating their credentials securely.

## 2. Requirements

### 2.1. User Flow

1.  **Request Reset:**
    *   A "Forgot Password?" link/button is available on the login interface.
    *   Clicking the link presents a form asking for the user's registered email address.
    *   Submitting the email triggers the backend to generate a unique, time-limited password reset token.
    *   The backend constructs a reset URL containing the token and the user's email.
    *   **(Phase 1)** The reset URL is logged to the server console.
    *   **(Phase 2 - Future)** An email is sent to the user containing the reset link.
    *   The frontend displays a confirmation message indicating that if the email exists, instructions will be sent.
2.  **Reset Password Page:**
    *   The user clicks the link from the email/log.
    *   They are directed to a dedicated "Reset Password" page (e.g., `/reset-password`).
    *   The page URL includes the token and email as query parameters (`/reset-password?token=...&email=...`).
    *   The page displays a form with:
        *   A disabled input field showing the user's email (parsed from the URL).
        *   A field for entering the new password.
        *   A field for confirming the new password.
    *   Submitting the form sends the token, email, and new password to the backend.
3.  **Password Update & Login:**
    *   The backend validates the token (existence, expiry, match with email).
    *   If valid, the backend updates the user's password hash in the database.
    *   The used token is invalidated or deleted.
    *   The user is automatically logged in with their new credentials.
    *   The user is redirected to their profile page (`/profile`).
    *   If the token is invalid or expired, an appropriate error message is displayed on the Reset Password page.

### 2.2. Technical Implementation

1.  **Database:**
    *   `[x]` Add a new `PasswordResetToken` model to `prisma/schema.prisma`.
    *   `[x]` Fields: `id`, `token` (unique string), `userId` (relation to `User`), `email` (user's email at time of request), `expiresAt` (DateTime), `createdAt` (DateTime).
    *   `[x]` Run `npx prisma migrate dev` to apply the changes.
2.  **Backend API (`src/server/routes/auth.ts`):**
    *   `[x]` `POST /api/auth/request-password-reset`:
        *   `[x]` Input: `{ email: string }`
        *   `[x]` Logic: Find user by email. Generate UUID/`crypto.randomUUID()`. Create `PasswordResetToken` record with user ID, email, and expiry (1 hour). Construct URL. Log URL.
        *   `[x]` Output: `200 OK` with a generic success message.
    *   `[x]` `POST /api/auth/reset-password`:
        *   `[x]` Input: `{ token: string, email: string, password: string }`
        *   `[x]` Logic: Find `PasswordResetToken`. Verify expiry/email. Find user. Hash password. Update `passwordHash`. Delete token. Create session.
        *   `[x]` Output: `200 OK` with user session. Handle errors.
3.  **Frontend:**
    *   `[x]` **Login Component (`LoginModal.tsx`):** Add "Forgot Password?" UI element triggering context state change.
    *   `[x]` **Forgot Password Form (`ForgotPasswordModal.tsx`):** Component with email input, submit button, calls `/api/auth/request-password-reset`. Displays confirmation/error message.
    *   `[x]` **New Route (`src/routes/index.tsx`):** Add `/reset-password`.
    *   `[x]` **Reset Password Page (`src/pages/ResetPassword.tsx`):**
        *   `[x]` Reads `token` and `email` from `useSearchParams`.
        *   `[x]` Displays form with disabled email, new password, confirm password inputs.
        *   `[x]` Handles form submission, calling `/api/auth/reset-password`.
        *   `[x]` Handles success (redirect to `/profile`) and error states.
4.  **Security:**
    *   `[x]` Tokens are unique (`crypto.randomUUID()`).
    *   `[x]` Tokens have a limited expiry time (1 hour).
    *   `[x]` Tokens are single-use (deleted after successful reset).
    *   `[ ]` Rate limiting should be considered for the request endpoint (future enhancement).
    *   `[x]` Validate password strength requirements (min length 6) on backend and frontend.

## 3. Acceptance Criteria

*   `[x]` User can request a password reset using their email.
*   `[x]` A unique reset link (logged to console initially) is generated.
*   `[x]` User can navigate to the reset link.
*   `[x]` The reset page shows the correct email and allows entering a new password.
*   `[x]` Submitting a valid new password on the reset page updates the user's password.
*   `[x]` The reset token is invalidated after use.
*   `[x]` The user is automatically logged in and redirected to `/profile` after a successful reset.
*   `[x]` Appropriate error messages are shown for invalid/expired tokens or mismatched emails.

## 4. Out of Scope (Initial Implementation)

*   `[ ]` Sending actual emails.
*   `[ ]` Rate limiting API endpoints.
*   `[ ]` UI design beyond basic functional elements consistent with the existing style.
*   `[ ]` Complex password strength indicator UI (backend validation is sufficient for now). 