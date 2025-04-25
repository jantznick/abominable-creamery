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

// --- UPDATED CreateOrderSchema to expect only checkoutAttemptId ---
const CreateOrderSchema = z.object({
	checkoutAttemptId: z.string().min(1, { message: "Checkout Attempt ID is required" }),
});

// --- Define Zod schema for the expected structure inside CheckoutAttempt.data ---
const CheckoutAttemptDataSchema = z.object({
	userId: z.number().int().nullable(),
	cartItems: z.array(OrderItemSchema), // Reuse existing OrderItemSchema
	contactInfo: ContactInfoSchema, // Reuse existing ContactInfoSchema
	shippingAddress: AddressSchema, // Reuse existing AddressSchema
	notes: z.string().optional(), // Include optional notes
	// Add totalAmount if it's reliably stored in CheckoutAttempt, otherwise recalculate
	// totalAmount: z.number().positive(), 
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

// POST /api/orders - Create a new order FROM a CheckoutAttempt ID
router.post('/', async (req: Request, res: Response) => {
	// 1. Validate request body for checkoutAttemptId
	const validationResult = CreateOrderSchema.safeParse(req.body);
	if (!validationResult.success) {
		console.error("Create Order validation failed (expecting checkoutAttemptId):", validationResult.error.errors);
		return res.status(400).json({ message: "Invalid request data", errors: validationResult.error.flatten() });
	}

	const { checkoutAttemptId } = validationResult.data;
	// We still check req.session.user.id consistency if available, but allow guests
	const sessionUserId = req.session.user?.id;

	try {
		// 2. Fetch the CheckoutAttempt record
		const attempt = await prisma.checkoutAttempt.findUnique({
			where: { id: checkoutAttemptId },
		});

		if (!attempt) {
			console.error(`CheckoutAttempt record not found for ID: ${checkoutAttemptId}`);
			return res.status(404).json({ message: 'Checkout session not found or expired.' });
		}

		// 3. Parse and Validate the data within the CheckoutAttempt record
		let parsedData: any;
		try {
			parsedData = JSON.parse(attempt.data as string); // Assuming attempt.data is JSON string
		} catch (parseError) {
			console.error(`Failed to parse JSON data for CheckoutAttempt ${checkoutAttemptId}:`, parseError);
			return res.status(500).json({ message: 'Internal error: Failed to process checkout data.' });
		}

		const dataValidationResult = CheckoutAttemptDataSchema.safeParse(parsedData);
		if (!dataValidationResult.success) {
			console.error(`Validation failed for data within CheckoutAttempt ${checkoutAttemptId}:`, dataValidationResult.error.errors);
			return res.status(400).json({ message: 'Invalid checkout session data.', errors: dataValidationResult.error.flatten() });
		}

		// Use the validated data from the attempt
		const { userId, cartItems, contactInfo, shippingAddress, notes } = dataValidationResult.data;

		// --- Security/Consistency Check: User ID --- 
		if (sessionUserId && userId && sessionUserId !== userId) {
			console.warn(`User ID mismatch: Session user (${sessionUserId}) differs from CheckoutAttempt user (${userId}) for ID ${checkoutAttemptId}.`);
			// Decide on handling: block, log, proceed? For now, log and proceed, using attempt's userId.
		}
		const finalUserId = userId; // Use the ID stored in the attempt

		// --- Calculate Total Amount --- 
		// Recalculate total from validated items for accuracy, as it might not be stored/reliable in attempt.data
		let totalAmount = new Prisma.Decimal(0);
		cartItems.forEach(item => {
			// item.price is validated as number by Zod
			totalAmount = totalAmount.plus(new Prisma.Decimal(item.price).times(item.quantity));
		});
		if (totalAmount.lessThanOrEqualTo(0)) {
			console.error(`Calculated total amount is not positive for CheckoutAttempt ${checkoutAttemptId}.`);
			return res.status(400).json({ message: 'Invalid order total calculated.' });
		}

		// 4. Create Order within a transaction
		const newOrder = await prisma.$transaction(async (tx) => {
			const orderData: Prisma.OrderCreateInput = {
				user: finalUserId ? { connect: { id: finalUserId } } : undefined,
				contactEmail: contactInfo.email,
				contactPhone: contactInfo.phone,
				status: 'PAID', // Assuming payment was successful if this endpoint is called
				totalAmount: totalAmount,
				checkoutAttemptId: checkoutAttemptId, // Link to the attempt ID
				// stripePaymentIntentId: paymentIntentId, // Removed - Should be added by webhook based on checkoutAttemptId metadata
				
				// Shipping Address fields from validated data
				shippingName: shippingAddress.fullName,
				shippingAddress1: shippingAddress.address1,
				shippingAddress2: shippingAddress.address2,
				shippingCity: shippingAddress.city,
				shippingState: shippingAddress.state,
				shippingPostalCode: shippingAddress.postalCode,
				shippingCountry: shippingAddress.country,
				// Add notes from validated data
				notes: notes,
				items: undefined // Items created separately
			};

			const order = await tx.order.create({ data: orderData });

			const orderItemsData = cartItems.map((item: OrderItemInput) => ({
				orderId: order.id,
				productId: item.productId,
				productName: item.productName,
				quantity: item.quantity,
				price: new Prisma.Decimal(item.price),
			}));

			await tx.orderItem.createMany({ data: orderItemsData });

			// --- Optional: Delete the CheckoutAttempt record after successful order creation ---
			try {
				await tx.checkoutAttempt.delete({ where: { id: checkoutAttemptId } });
				console.log(`Successfully deleted CheckoutAttempt record ${checkoutAttemptId}`);
			} catch (deleteError) {
				// Log deletion error but don't fail the transaction
				console.error(`Failed to delete CheckoutAttempt record ${checkoutAttemptId}:`, deleteError);
			}
			// ----------------------------------------------------------------------------------

			return order;
		});

		// --- Removed Stripe PaymentIntent Metadata Update --- 
		// This should be handled by the webhook using the checkoutAttemptId from event metadata

		console.log(`Order ${newOrder.id} created successfully from CheckoutAttempt ${checkoutAttemptId}`);
		res.status(201).json({ 
			message: 'Order created successfully', 
			orderId: newOrder.id, 
			status: newOrder.status 
		});

	} catch (error) {
		console.error(`Failed to create order from CheckoutAttempt ${checkoutAttemptId}:`, error);
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// P2002: Unique constraint failed (e.g., trying to create order for same checkoutAttemptId twice)
			if (error.code === 'P2002') {
				// Check which field caused the error, likely checkoutAttemptId unique constraint
				const target = (error.meta as any)?.target;
				console.warn(`Unique constraint violation on creating order from attempt ${checkoutAttemptId}. Target: ${target}`);
				return res.status(409).json({ message: 'Conflict: Order may have already been created for this checkout session.' });
			}
			// P2003: Foreign key constraint failed (e.g., invalid finalUserId if provided)
            if (error.code === 'P2003') {
                const failedField = (error.meta as any)?.field_name || 'unknown field';
                console.error(`Foreign key constraint failed on field: ${failedField} for attempt ${checkoutAttemptId}`);
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