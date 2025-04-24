// src/server/types/index.ts
import { UserRole } from '@prisma/client'; // Import UserRole enum if needed

// Define a common structure for the user object stored in the session
export interface SessionUser {
    id: number;
    email: string;
    name?: string | null;
    phone?: string | null; // Add phone
    role: UserRole; // Add role
    stripeCustomerId?: string | null;
    // Add other relevant user fields used across different routes if needed
} 