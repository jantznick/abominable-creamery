import express, { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db'; // Import the singleton Prisma client
import { z, infer as ZodInfer } from 'zod'; // Using Zod for validation
import { Prisma } from '@prisma/client'; // Import Prisma types
import Stripe from 'stripe'; // Import Stripe
import dotenv from 'dotenv'; // Import dotenv

// Load environment variables
dotenv.config();

// Initialize Stripe (similar to serverRender.tsx)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("ORDERS ROUTE Error: STRIPE_SECRET_KEY is not set in the environment variables.");
    // Depending on requirements, you might handle this differently, 
    // but updating PaymentIntent will fail without the key.
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;

// --- Zod Schemas for Validation (Aligned with Prisma Schema) ---
const AddressSchema = z.object({
    fullName: z.string().min(1, { message: "Full name is required" }),
    address1: z.string().min(1, { message: "Address line 1 is required" }),
    address2: z.string().optional(),
    city: z.string().min(1, { message: "City is required" }),
    state: z.string().min(1, { message: "State is required" }),
    postalCode: z.string().min(1, { message: "Postal code is required" }),
    country: z.string().min(1, { message: "Country is required" })
});

const ContactInfoSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    phone: z.string().optional(), 
});

const OrderItemSchema = z.object({
    productId: z.string().min(1), // Changed to string
    productName: z.string().min(1), // Added productName
    quantity: z.number().int().min(1, { message: "Item quantity must be at least 1" }),
    price: z.number().positive({ message: "Item price must be positive" }) // Expect price in dollars
});

// Infer the type from Zod schema for item mapping
type OrderItemInput = ZodInfer<typeof OrderItemSchema>;

const CreateOrderSchema = z.object({
    items: z.array(OrderItemSchema).min(1, { message: "Order must contain at least one item" }),
    totalAmount: z.number().positive({ message: "Total amount must be positive" }), // Expect total in dollars
    shippingAddress: AddressSchema,
    contactInfo: ContactInfoSchema,
    paymentIntentId: z.string().min(1, { message: "Payment Intent ID is required" }),
});

const router: Router = express.Router();

// --- Middleware (Placeholder for Auth Checks) ---

// Placeholder middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }
    next();
};

// Placeholder middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// --- Order Routes ---

// POST /api/orders - Create a new order
router.post('/', async (req: Request, res: Response) => {
    // 1. Validate request body
    const validationResult = CreateOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
        console.error("Order validation failed:", validationResult.error.errors);
        // Use flatten() for potentially cleaner error reporting to frontend
        return res.status(400).json({ message: "Invalid order data", errors: validationResult.error.flatten() });
    }

    const { items, totalAmount, shippingAddress, contactInfo, paymentIntentId } = validationResult.data;
    const userId = req.session.user?.id;

    try {
        const newOrder = await prisma.$transaction(async (tx) => {
            // Prepare Order data separately for clarity
            const orderData: Prisma.OrderCreateInput = {
                // Use connect syntax for relation if userId exists
                user: userId ? { connect: { id: userId } } : undefined,
                contactEmail: contactInfo.email,
                contactPhone: contactInfo.phone,
                status: 'PAID', // Try direct string assignment again, as schema defines 'PAID'
                totalAmount: new Prisma.Decimal(totalAmount),
                // stripePaymentIntentId: paymentIntentId, // <-- FIELD MISSING IN SCHEMA!
                
                // Shipping Address fields
                shippingName: shippingAddress.fullName,
                shippingAddress1: shippingAddress.address1,
                shippingAddress2: shippingAddress.address2,
                shippingCity: shippingAddress.city,
                shippingState: shippingAddress.state,
                shippingPostalCode: shippingAddress.postalCode,
                shippingCountry: shippingAddress.country,
                // Items will be created separately below
                items: undefined // Explicitly undefined here, created via createMany later
            };

            const order = await tx.order.create({ data: orderData });

            // Create OrderItem records
            const orderItemsData = items.map((item: OrderItemInput) => ({
                orderId: order.id,
                productId: item.productId, 
                productName: item.productName, // Still using productName as per schema
                quantity: item.quantity,
                price: new Prisma.Decimal(item.price),
            }));

            // Use createMany for OrderItems
            await tx.orderItem.createMany({ data: orderItemsData });

            // Return the created order (without items, as they aren't included by default)
            // If items are needed in response, a separate query/include would be necessary
            return order; 
        });

        // --- Update Stripe PaymentIntent Metadata (After successful DB transaction) ---
        if (stripe) {
            try {
                await stripe.paymentIntents.update(paymentIntentId, {
                    metadata: { 
                        // Add or update the order_id. This merges with existing metadata by default.
                        // If a key exists, it's updated; otherwise, it's added.
                        order_id: newOrder.id 
                    }
                });
                console.log(`Successfully updated Stripe PaymentIntent ${paymentIntentId} with order ID ${newOrder.id}`);
            } catch (stripeError) {
                // Log the error but don't fail the response to the client,
                // as the order *was* created in the database.
                console.error(`Failed to update Stripe PaymentIntent ${paymentIntentId} metadata:`, stripeError);
                // Optional: Could queue this for retry or notify monitoring.
            }
        } else {
             console.warn(`Stripe not initialized. Could not update PaymentIntent ${paymentIntentId} metadata.`);
        }
        // --- End Stripe Update ---

        console.log(`Order ${newOrder.id} created successfully for ${userId ? `user ${userId}` : `guest ${contactInfo.email}`}`);
        res.status(201).json({ 
            message: 'Order created successfully', 
            orderId: newOrder.id, 
            status: newOrder.status 
        });

    } catch (error) {
        console.error("Failed to create order:", error);
        // 6. Handle potential errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Handle specific Prisma errors if needed
            if (error.code === 'P2002') { // Unique constraint failed
                 // Consider if paymentIntentId should be unique in schema
                 return res.status(409).json({ message: 'Conflict: Order potentially already created for this payment.' });
            }
             // Example: Foreign key constraint failed (e.g., invalid userId or productId)
            if (error.code === 'P2003') {
                // Check error.meta.field_name to see which constraint failed
                const failedField = (error.meta as any)?.field_name || 'unknown field';
                console.error(`Foreign key constraint failed on field: ${failedField}`);
                 return res.status(400).json({ message: `Invalid reference for field: ${failedField}` });
            }
        }
        res.status(500).json({ message: 'Internal server error while creating order.' });
    }
});

// GET /api/orders/my - Get orders for the currently logged-in user
router.get('/my', isAuthenticated, async (req: Request, res: Response) => {
    const userId = req.session.user!.id; 

    try {
        const userOrders = await prisma.order.findMany({
            where: { userId: userId },
            select: { // Use select to specify exactly what fields to return
                id: true,
                userId: true,
                contactEmail: true,
                status: true,
                totalAmount: true,
                createdAt: true,
                // Select shipping address fields
                shippingName: true,
                shippingAddress1: true,
                shippingAddress2: true,
                shippingCity: true,
                shippingState: true,
                shippingPostalCode: true,
                shippingCountry: true,
                // Include related items
                items: {
                    select: {
                        id: true,
                        productId: true,
                        productName: true,
                        quantity: true,
                        price: true,
                    }
                }, 
            },
            orderBy: {
                createdAt: 'desc', 
            },
        });

        res.status(200).json(userOrders);

    } catch (error) {
        console.error(`Error fetching orders for user ${userId}:`, error);
        res.status(500).json({ message: 'Internal server error while fetching orders.' });
    }
});

// GET /api/orders/all - Get all orders (Admin only)
router.get('/all', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const allOrders = await prisma.order.findMany({
            select: { // Use select to specify exactly what fields to return
                id: true,
                userId: true,
                contactEmail: true,
                status: true,
                totalAmount: true,
                createdAt: true,
                // Select shipping address fields
                shippingName: true,
                shippingAddress1: true,
                shippingAddress2: true,
                shippingCity: true,
                shippingState: true,
                shippingPostalCode: true,
                shippingCountry: true,
                // Include related items
                items: {
                    select: {
                        id: true,
                        productId: true,
                        productName: true,
                        quantity: true,
                        price: true,
                    }
                },
                // Include related user info
                user: {      
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            // TODO: Add pagination later
        });

        res.status(200).json(allOrders);

    } catch (error) {
        console.error(`Error fetching all orders for admin ${req.session.user?.id}:`, error);
        res.status(500).json({ message: 'Internal server error while fetching all orders.' });
    }
});

// PATCH /api/orders/:orderId/status - Update order status (Admin only)
router.patch('/:orderId/status', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { status } = req.body; // Expecting { status: "SHIPPED" } or similar

    // Basic validation
    if (!orderId || !status) {
        return res.status(400).json({ message: 'Missing order ID or status in request.' });
    }

    // Validate status value (optional but recommended)
    const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'PROCESSING', 'CANCELLED', 'DELIVERED']; // Example statuses
    if (!validStatuses.includes(status.toUpperCase())) {
         return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        const updatedOrder = await prisma.order.update({
            where: {
                id: parseInt(orderId, 10), // Ensure orderId is an integer
            },
            data: {
                status: status.toUpperCase(), // Ensure consistent casing
            },
            select: { // Return only essential fields to confirm update
                id: true,
                status: true,
            }
        });

        console.log(`Admin ${req.session.user?.id} updated order ${orderId} status to ${status.toUpperCase()}`);
        res.status(200).json(updatedOrder);

    } catch (error) {
        console.error(`Error updating status for order ${orderId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2025: Record to update not found.
            if (error.code === 'P2025') {
                return res.status(404).json({ message: `Order with ID ${orderId} not found.` });
            }
        }
         if (error instanceof TypeError && error.message.includes('parseInt')) {
             return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Internal server error while updating order status.' });
    }
});

export default router; 