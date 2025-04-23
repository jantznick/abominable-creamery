import express, { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db'; // Import the singleton instance

const router: Router = express.Router();
const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

// Define the structure for session user data based on the Prisma schema
interface SessionUser {
	id: number;
	email: string;
	name: string | null;
	role: 'USER' | 'ADMIN'; // Match UserRole enum
	createdAt: Date;
	updatedAt: Date;
}

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
                role: email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'USER' // Default role
            },
        });

        // Exclude hash - TypeScript infers userSessionData type
        const { passwordHash: _, ...userSessionData } = newUser;
        // Assign to session (should match SessionUser structure)
        req.session.user = {
            id: userSessionData.id,
            email: userSessionData.email,
            name: userSessionData.name,
            role: userSessionData.role,
            createdAt: userSessionData.createdAt,
            updatedAt: userSessionData.updatedAt,
        };

        console.log('User signed up and logged in:', userSessionData.email);
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
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' }); // Unauthorized
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' }); // Unauthorized
        }

        // Login successful - Create session
        // Exclude hash
        const { passwordHash: _, ...userSessionData } = user;
        // Assign to session (should match SessionUser structure)
        req.session.user = {
            id: userSessionData.id,
            email: userSessionData.email,
            name: userSessionData.name,
            role: userSessionData.role,
            createdAt: userSessionData.createdAt,
            updatedAt: userSessionData.updatedAt,
        };

        console.log('User logged in:', userSessionData.email);
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

export default router;
 