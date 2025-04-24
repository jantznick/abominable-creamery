import express, { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db'; // Import the singleton instance
// Import SessionUser from the shared types file
import { SessionUser } from '../types'; 

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

export default router;
 