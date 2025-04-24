import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '../db'; // Import the singleton instance

// Remove Session augmentation - rely on definition in auth.ts
/*
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      name: string | null;
      role: string; 
    };
  }
}
*/

const router: Router = express.Router();

// Middleware to ensure user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ message: 'Unauthorized: Please log in.' });
  }
};

// Basic email validation helper
const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Basic phone number validation (example: allows digits, spaces, +, -, ())
// Adjust regex as needed for stricter validation
const isValidPhone = (phone: string): boolean => {
    // Allows empty string or null/undefined to pass as it's optional
    if (!phone) return true;
    return /^[+]?[\d\s()-]+$/.test(phone);
};

// Apply authentication middleware to all routes in this router
router.use(isAuthenticated);

// GET /api/users/me - Get current logged-in user's profile
router.get('/me', async (req: Request, res: Response) => {
    // The user object is attached to req.session by isAuthenticated middleware
    // We already fetched the necessary data when logging in or signing up.
    if (!req.session.user) {
        // This check might be redundant if isAuthenticated works correctly,
        // but safe to keep as a fallback.
        return res.status(401).json({ message: 'User not found in session' });
    }
    res.status(200).json({ user: req.session.user });
});

// PUT /api/users/me - Update current logged-in user's profile
router.put('/me', async (req: Request, res: Response) => {
    // Add explicit check for session user to satisfy TypeScript
    if (!req.session.user) {
        // This should not be reachable if isAuthenticated middleware is effective
        return res.status(401).json({ message: 'Not authenticated' }); 
    }

    const userId = req.session.user.id; // Now TypeScript knows req.session.user is defined
    const { name, email, phone } = req.body; // Include phone

    // --- Validation ---
    if (email && typeof email !== 'string') {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    if (name && typeof name !== 'string') {
        return res.status(400).json({ message: 'Invalid name format' });
    }
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
         return res.status(400).json({ message: 'Invalid phone format' });
    }
    if (phone && !isValidPhone(phone)) {
        return res.status(400).json({ message: 'Invalid phone number characters' });
    }

    // --- Prepare Update Data ---
    const updateData: { name?: string | null; email?: string; phone?: string | null } = {};
    if (name !== undefined) {
        updateData.name = name.trim() || null;
    }
    if (email !== undefined) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        updateData.email = email;
    }
    if (phone !== undefined) {
        updateData.phone = phone.trim() || null;
    }


    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided' });
    }

    try {
        // --- Check for Email Conflict ---
        if (updateData.email && updateData.email !== req.session.user.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: updateData.email },
            });
            if (existingUser && existingUser.id !== userId) {
                return res.status(409).json({ message: 'Email already in use' });
            }
        }

        // --- Perform Update ---
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
             select: {
                id: true,
                email: true,
                name: true,
                phone: true, // Select phone
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        // --- Update Session ---
        req.session.user = {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone, // Update phone in session
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };

        console.log('User profile updated:', req.session.user.email);
        res.status(200).json({ user: req.session.user }); // Return updated user data

    } catch (error) {
        console.error("User Update Error:", error);
        res.status(500).json({ message: 'Internal server error during profile update' });
    }
});

// --- Admin Routes (Example - Requires Admin Role Check) ---
// GET /api/users - Get all users (Admin only)
// DELETE /api/users/:id - Delete a user (Admin only)
// ... (Implement admin routes with proper authorization) ...

export default router; 