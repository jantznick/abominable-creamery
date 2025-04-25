import express, { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db'; // Import the singleton instance
// Import SessionUser from the shared types file
import { SessionUser } from '../types';
// import { v4 as uuidv4 } from 'uuid'; // REMOVE - Use built-in crypto
import crypto from 'crypto'; // ADD - For randomUUID

const router: Router = express.Router();
const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

// Extend Express SessionData to include user
declare module 'express-session' {
	interface SessionData {
		user?: SessionUser; // Use the defined interface
	}
}

// --- Helper Functions ---

// Basic email validation
const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Middleware to check if user is already authenticated
const checkNotAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.user) {
        // If user is logged in, perhaps redirect or send error?
        // For API routes, sending an error is usually better.
        return res.status(400).json({ message: 'Already logged in' });
    }
    next();
};

// --- Routes ---

// POST /api/auth/signup
router.post('/signup', checkNotAuthenticated, async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    // Basic Input Validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    if (password.length < 6) { // Example minimum password length
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' }); // 409 Conflict
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name: name || null, // Optional name
                phone: null, // Initialize phone as null explicitly
                role: email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'USER' // Default role
            },
            // Select ONLY the fields needed for the immediate session
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                stripeCustomerId: true // Select this too, even if null initially
                // Remove fields not in SessionUser
                // createdAt: true,
                // updatedAt: true,
            }
        });

        // Assign selected data directly to session (matching SessionUser structure)
        req.session.user = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            phone: newUser.phone,
            role: newUser.role,
            stripeCustomerId: newUser.stripeCustomerId // Should be selected now
            // Remove fields not in SessionUser
            // createdAt: newUser.createdAt,
            // updatedAt: newUser.updatedAt,
        };

        console.log('User signed up and logged in:', newUser.email);
        res.status(201).json({ user: req.session.user }); // Send back session user data

    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Internal server error during signup' });
    }
});

// POST /api/auth/login
router.post('/login', checkNotAuthenticated, async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            // Select the fields needed for the session AND the hash for comparison
             select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                passwordHash: true,
            }
        });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare password (user.passwordHash should now be defined)
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' }); 
        }

        // Login successful - Create session
        // Assign ONLY fields defined in SessionUser to req.session.user
        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            stripeCustomerId: (user as any).stripeCustomerId || null // Need to ensure stripeCustomerId is selected or handle potentially missing field
        };

        console.log('User logged in:', user.email);
        res.status(200).json({ user: req.session.user });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Internal server error during login' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Error:", err);
            return next(err); // Pass error to Express error handler
        }
        res.clearCookie('connect.sid'); // Optional: Clear the session cookie
        console.log('User logged out');
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
    if (req.session.user) {
        res.status(200).json({ user: req.session.user });
    } else {
        res.status(401).json({ message: 'Not authenticated' }); // Unauthorized
    }
});

// POST /api/auth/request-password-reset
router.post('/request-password-reset', async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
        // Even if email is invalid, return a generic message to avoid user enumeration
        return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been processed.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            // Generate a unique token
            // const token = uuidv4(); // REMOVE
            const token = crypto.randomUUID(); // ADD - Use built-in method
            // Set expiry time (e.g., 1 hour from now)
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            // Store the token, associating it with the user and email
            await prisma.passwordResetToken.create({
                data: {
                    token,
                    userId: user.id,
                    email: user.email, // Store email used for request for extra verification
                    expiresAt,
                },
            });

            // Construct the reset URL (adjust FRONTEND_URL as needed)
            // TODO: Replace 'http://localhost:3000' with an environment variable for the frontend URL
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

            // Log the URL (replace with email sending later)
            console.log(`Password Reset URL for ${email}: ${resetUrl}`);
        }

        // Always return a generic success message regardless of whether the user was found
        // This prevents attackers from discovering registered emails.
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been processed.' });

    } catch (error) {
        console.error("Request Password Reset Error:", error);
        // Even in case of internal error, send a generic message if possible,
        // unless it's a fundamental issue preventing any response.
        res.status(500).json({ message: 'An internal error occurred. Please try again later.' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, email, password } = req.body;

    // Basic Validation
    if (!token || !email || !password) {
        return res.status(400).json({ message: 'Token, email, and new password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (password.length < 6) { // Reuse same password length requirement
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        // 1. Find the token and verify email match and expiry
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        }
        if (resetToken.email !== email) {
             // Email in request doesn't match the one associated with the token
            console.warn(`Password reset attempt with mismatched email for token ${token}. Request email: ${email}, Token email: ${resetToken.email}`);
            return res.status(400).json({ message: 'Invalid password reset request.' });
        }
         if (new Date() > resetToken.expiresAt) {
            // Clean up expired token while we're here (optional, could also have a scheduled job)
            await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
            return res.status(400).json({ message: 'Password reset token has expired.' });
        }

        // 2. Find the associated user
        const user = await prisma.user.findUnique({
            where: { id: resetToken.userId },
             // Select fields needed for session
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                stripeCustomerId: true
            }
        });

        if (!user) {
            // Should not happen if token exists, but good to check
            console.error(`User not found for valid reset token ID: ${resetToken.id}, UserID: ${resetToken.userId}`);
            // Invalidate the token as something is wrong
             await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
            return res.status(404).json({ message: 'User associated with this token not found.' });
        }

        // 3. Hash the new password
        const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 4. Update the user's password
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash },
        });

        // 5. Delete the used token
        await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

        // 6. Log the user in (create a new session)
        req.session.regenerate((err) => {
             if (err) {
                console.error("Session regeneration failed after password reset:", err);
                // Even if session fails, password was reset. Send success but maybe indicate login failed.
                return res.status(500).json({ message: 'Password successfully reset, but failed to log you in automatically. Please log in manually.' });
            }

            // Assign ONLY fields defined in SessionUser
            req.session.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
                stripeCustomerId: user.stripeCustomerId
            };
            console.log(`User ${user.email} password reset and logged in.`);
            res.status(200).json({ user: req.session.user }); // Send back session user data
        });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'Internal server error during password reset.' });
    }
});

export default router;
 