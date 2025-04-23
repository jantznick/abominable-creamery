import express, { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db'; // Import the singleton Prisma client
import { z, infer as ZodInfer } from 'zod'; // Using Zod for validation
import { Prisma } from '@prisma/client'; // Import Prisma types

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
    // User is guaranteed to be authenticated by middleware
    const userId = req.session.user!.id; 

    try {
        const userOrders = await prisma.order.findMany({
            where: { userId: userId },
            include: {
                items: true, // Include order items
            },
            orderBy: {
                createdAt: 'desc', // Show newest orders first
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
    // User is guaranteed to be an admin by middleware
    try {
        const allOrders = await prisma.order.findMany({
            include: {
                items: true, // Include order items
                user: {      // Include basic user info (if relation exists)
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
            // TODO: Add pagination later (e.g., using query params skip/take)
        });

        res.status(200).json(allOrders);

    } catch (error) {
        console.error(`Error fetching all orders for admin ${req.session.user?.id}:`, error);
        res.status(500).json({ message: 'Internal server error while fetching all orders.' });
    }
});


export default router; 