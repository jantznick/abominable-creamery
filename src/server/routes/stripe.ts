import express, { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import prisma from '../db'; // Adjusted path again
import { CartItem } from '../../../src/context/CartContext'; // Keep this if CartItem is used outside InitiateCheckoutRequest
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal
import { SessionUser } from '../types'; // Import SessionUser from the shared types file
import { saveCheckoutAttempt, getCheckoutAttempt, deleteCheckoutAttempt } from '../utils/checkoutTmpStore';
import { OrderStatus, Order, OrderItem } from '@prisma/client'; // Keep OrderStatus etc. if used directly
// Import the new webhook handler functions
import {
    handleSetupIntentSucceeded,
    handlePaymentIntentSucceeded,
    handlePaymentIntentPaymentFailed,
    handleCustomerSubscriptionCreated,
    handleCustomerSubscriptionDeleted,
    handleCustomerSubscriptionUpdated,
    handleInvoicePaid,
    handleInvoicePaymentFailed,
    handleUnhandledEvent
} from '../services/stripeWebhookHandlers';
// Import extracted types and helpers
import { InitiateCheckoutRequest, FetchedOrder, OrderItemWithImage } from '../types/stripeTypes';
import { getImageUrls } from '../services/stripeUtils';

// Load environment variables
dotenv.config();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("STRIPE ROUTE Error: STRIPE_SECRET_KEY is not set.");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Define secret here

const router: Router = express.Router();

// Middleware for raw body specific to webhook
const stripeWebhookMiddleware = express.raw({ type: 'application/json' });

// GET /api/stripe/payment-intent/:paymentIntentId
// Retrieves the status of a Stripe PaymentIntent AND attempts to find associated order details (final or temporary) with images
router.get('/payment-intent/:paymentIntentId', express.json(), async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe service is not available.' });
    }

    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing Payment Intent ID.' });
    }

    try {
        const paymentIntent = await stripe!.paymentIntents.retrieve(paymentIntentId);
        // Explicitly type fetchedOrderFromDb
        let fetchedOrderFromDb: FetchedOrder | null = null;
        let finalOrderDetails: any = null; // Keep as any for now as it can hold final or temp structure
        const checkoutAttemptId = paymentIntent.metadata?.checkoutAttemptId;

        if (checkoutAttemptId) {
            console.log(`PI Route: Found checkoutAttemptId ${checkoutAttemptId}, looking for FINAL Order...`);
            fetchedOrderFromDb = await prisma.order.findUnique({
                where: { checkoutAttemptId: checkoutAttemptId },
                include: {
                    items: { 
                        select: {
                            id: true, productId: true, productName: true, quantity: true, price: true
                        }
                    } 
                }
            });

            if (fetchedOrderFromDb !== null) {
                // Assign to a new const within the narrowed scope
                const order = fetchedOrderFromDb;
                // --- Final Order Found --- 
                console.log(`PI Route: Found FINAL Order ${order.id}. Fetching images...`);
                finalOrderDetails = { ...order, items: [] }; 
                if (order.items.length > 0) {
                    const productIds = order.items.map(item => item.productId).filter((id): id is string => id !== null);
                    // Pass stripe instance to getImageUrls
                    const imageUrls = await getImageUrls(stripe, productIds);
                    const itemsWithImages = order.items.map(item => ({
                        ...item,
                        // Use nullish coalescing for safety
                        imageUrl: item.productId ? (imageUrls[item.productId] ?? null) : null 
                    }));
                    finalOrderDetails.items = itemsWithImages;
                    console.log(`PI Route: Added image URLs to FINAL order items.`);
                } else {
                    console.log(`PI Route: Found FINAL Order ${order.id} but it has no items.`);
                }
            } else {
                 // --- Final Order NOT Found - Try Temporary Context --- 
                console.log(`PI Route: FINAL Order not found for ${checkoutAttemptId}. Trying temporary context...`);
                const tempContext = await getCheckoutAttempt(checkoutAttemptId);
                if (tempContext) {
                    console.log(`PI Route: Found temporary context for ${checkoutAttemptId}. Reconstructing summary...`);
                    const { cartItems } = tempContext;
                    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
                        // Fetch images for temporary items
                        const tempItemsWithImages: OrderItemWithImage[] = await Promise.all(
                            cartItems.map(async (item: any) => { // Use 'any' for items from JSON
                                let imageUrl: string | null = null;
                                try {
                                    const stripeProduct = await stripe!.products.retrieve(item.productId);
                                    imageUrl = stripeProduct?.images?.[0] || null;
                                } catch (prodError: any) {
                                    console.warn(`Could not fetch Stripe product ${item.productId} for temp context ${checkoutAttemptId}: ${prodError.message}`);
                                }
                                // Need to create Decimal for price
                                const priceDecimal = new Decimal(item.price || 0);
                                return { 
                                    id: 0, // No real DB ID for temp item
                                    productId: item.productId,
                                    productName: item.productName,
                                    quantity: item.quantity,
                                    price: priceDecimal, // Use Decimal
                                    imageUrl 
                                }; 
                            })
                        );
                        
                        // Calculate total from temp items
                        let tempTotal = new Decimal(0);
                        tempItemsWithImages.forEach(item => {
                            tempTotal = tempTotal.plus(item.price.times(item.quantity));
                        });

                        // Construct the temporary orderDetails object
                        finalOrderDetails = {
                            id: 0, // Placeholder ID
                            status: 'PENDING', // Indicate it's not finalized
                            totalAmount: tempTotal,
                            items: tempItemsWithImages,
                            // Include other fields as needed/available from context, or null/defaults
                            userId: tempContext.userId,
                            contactEmail: tempContext.contactInfo.email,
                            shippingName: tempContext.shippingAddress.fullName,
                             // Add other fields if OrderSummaryDisplay needs them, else null
                            createdAt: new Date(), // Placeholder time
                            updatedAt: new Date(),
                            checkoutAttemptId: checkoutAttemptId, // Include the ID
                            isPending: true // Explicit flag 
                        };
                        console.log(`PI Route: Reconstructed summary from temporary context.`);
                    } else {
                         console.log(`PI Route: Temporary context for ${checkoutAttemptId} has no items.`);
                    }
                } else {
                     console.log(`PI Route: Temporary context for ${checkoutAttemptId} also not found.`);
                }
            }
        } else {
             console.log(`PI Route: No checkoutAttemptId found in PaymentIntent ${paymentIntent.id} metadata.`);
        }

        res.status(200).json({
            stripeStatus: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            id: paymentIntent.id,
            orderDetails: finalOrderDetails // Send final OR reconstructed details
        });

    } catch (error: any) {
        console.error(`Error fetching Payment Intent ${paymentIntentId}:`, error.message);
        if (error.type === 'StripeInvalidRequestError') {
             return res.status(404).json({ error: 'Payment Intent not found or invalid ID.' });
        }
        res.status(500).json({ error: 'Failed to retrieve payment intent status.' });
    }
});

// GET /api/stripe/setup-intent/:setupIntentId 
// Retrieves the status of a Stripe SetupIntent AND attempts to find associated order/subscription details (final or temporary) with images
router.get('/setup-intent/:setupIntentId', express.json(), async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe service is not available.' });
    }

    const { setupIntentId } = req.params;

    if (!setupIntentId) {
        return res.status(400).json({ error: 'Missing Setup Intent ID.' });
    }

    try {
        const setupIntent = await stripe!.setupIntents.retrieve(setupIntentId);
        // Explicitly type fetchedOrderFromDb
        let fetchedOrderFromDb: FetchedOrder | null = null;
        let subscriptionDetails = null; // Type later if needed
        let finalOrderDetails: any = null; // Keep as any
        const checkoutAttemptId = setupIntent.metadata?.checkoutAttemptId;

        if (checkoutAttemptId) {
            console.log(`SI Route: Found checkoutAttemptId ${checkoutAttemptId}, looking for FINAL Order/Subscription...`);
            fetchedOrderFromDb = await prisma.order.findUnique({
                where: { checkoutAttemptId: checkoutAttemptId },
                include: {
                    items: { 
                         select: {
                            id: true, productId: true, productName: true, quantity: true, price: true
                        }
                    } 
                }
            });
             subscriptionDetails = await prisma.subscription.findFirst({
                 where: { checkoutAttemptId: checkoutAttemptId },
            });

            if (fetchedOrderFromDb !== null) {
                // Assign to a new const within the narrowed scope
                const order = fetchedOrderFromDb;
                // --- Final Order Found --- 
                console.log(`SI Route: Found FINAL Order ${order.id}. Fetching images...`);
                finalOrderDetails = { ...order, items: [] }; 
                if (order.items.length > 0) {
                    const productIds = order.items.map(item => item.productId).filter((id): id is string => id !== null);
                    // Pass stripe instance to getImageUrls
                    const imageUrls = await getImageUrls(stripe, productIds);
                    const itemsWithImages = order.items.map(item => ({
                        ...item,
                        // Use nullish coalescing for safety
                        imageUrl: item.productId ? (imageUrls[item.productId] ?? null) : null
                    }));
                    finalOrderDetails.items = itemsWithImages;
                    console.log(`SI Route: Added image URLs to FINAL order items.`);
                } else {
                    console.log(`SI Route: Found FINAL Order ${order.id} but it has no items.`);
                }
                // Keep subscriptionDetails if found alongside final order
                 if (subscriptionDetails) console.log(`SI Route: Found FINAL Subscription ${subscriptionDetails.id}`);
            } else {
                // --- Final Order NOT Found - Try Temporary Context --- 
                console.log(`SI Route: FINAL Order not found for ${checkoutAttemptId}. Trying temporary context...`);
                const tempContext = await getCheckoutAttempt(checkoutAttemptId);
                 if (tempContext) {
                    console.log(`SI Route: Found temporary context for ${checkoutAttemptId}. Reconstructing summary...`);
                    const { cartItems } = tempContext;
                    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
                        // Fetch images for temporary items
                        const tempItemsWithImages: OrderItemWithImage[] = await Promise.all(
                             cartItems.map(async (item: any) => {
                                let imageUrl: string | null = null;
                                try {
                                    const stripeProduct = await stripe!.products.retrieve(item.productId);
                                    imageUrl = stripeProduct?.images?.[0] || null;
                                } catch (prodError: any) {
                                    console.warn(`Could not fetch Stripe product ${item.productId} for temp context ${checkoutAttemptId}: ${prodError.message}`);
                                }
                                const priceDecimal = new Decimal(item.price || 0);
                                return { 
                                    id: 0, productId: item.productId, productName: item.productName,
                                    quantity: item.quantity, price: priceDecimal, imageUrl 
                                }; 
                            })
                        );
                        
                        // Calculate total from temp items
                        let tempTotal = new Decimal(0);
                        tempItemsWithImages.forEach(item => {
                            tempTotal = tempTotal.plus(item.price.times(item.quantity));
                        });

                        // Construct the temporary orderDetails object
                        finalOrderDetails = {
                            id: 0, status: 'PENDING', totalAmount: tempTotal,
                            items: tempItemsWithImages,
                            userId: tempContext.userId, contactEmail: tempContext.contactInfo.email,
                            shippingName: tempContext.shippingAddress.fullName,
                            createdAt: new Date(), updatedAt: new Date(),
                            checkoutAttemptId: checkoutAttemptId, isPending: true
                        };
                        console.log(`SI Route: Reconstructed summary from temporary context.`);
                        // Subscription details might still be null if webhook hasn't run for sub yet
                        if (!subscriptionDetails) console.log(`SI Route: Subscription details not found yet for ${checkoutAttemptId}.`);
                         else console.log(`SI Route: Found FINAL Subscription ${subscriptionDetails.id} alongside temp order context.`);
                    } else {
                         console.log(`SI Route: Temporary context for ${checkoutAttemptId} has no items.`);
                    }
                 } else {
                     console.log(`SI Route: Temporary context for ${checkoutAttemptId} also not found.`);
                     // Also means subscription cannot be found via this ID
                     if (!subscriptionDetails) console.log(`SI Route: FINAL Subscription also not found for ${checkoutAttemptId}.`);
                 }
            }
        } else {
             console.log(`SI Route: No checkoutAttemptId found in SetupIntent ${setupIntent.id} metadata.`);
        }
        
        res.status(200).json({
            stripeStatus: setupIntent.status,
            id: setupIntent.id,
            orderDetails: finalOrderDetails, // Send final OR reconstructed details
            subscriptionDetails: subscriptionDetails
        });

    } catch (error: any) {
        console.error(`Error fetching Setup Intent ${setupIntentId}:`, error.message);
        if (error.type === 'StripeInvalidRequestError') {
             return res.status(404).json({ error: 'Setup Intent not found or invalid ID.' });
        }
        res.status(500).json({ error: 'Failed to retrieve setup intent status.' });
    }
});

// POST /api/stripe/initiate-checkout - Creates SetupIntent (for subs) or PaymentIntent (one-time)
router.post('/initiate-checkout', express.json(), async (req: Request, res: Response) => {
	if (!stripe) {
		return res.status(500).send({ error: 'Stripe is not configured.' });
	}

	// Destructure notes, selectedCardId, saveNewCardForFuture from the request body
	const { items, contactInfo, shippingAddress, notes, selectedCardId, saveNewCardForFuture } = req.body as InitiateCheckoutRequest;
	const sessionUser = req.session.user as SessionUser | undefined;

	// --- Basic Validations (keep existing) ---
	if (!items || !Array.isArray(items) || items.length === 0 || !contactInfo || !shippingAddress) {
		return res.status(400).send({ error: 'Invalid request body: missing items, contact, or shipping info.' });
	}
	if (!contactInfo.email || !shippingAddress.fullName || !shippingAddress.address1 ||
		!shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode || !shippingAddress.country) {
		return res.status(400).send({ error: 'Missing required contact or shipping fields.' });
	}
	if (selectedCardId && saveNewCardForFuture) {
		return res.status(400).send({ error: 'Cannot select a saved card AND save a new card simultaneously.' });
	}
	if ((selectedCardId || saveNewCardForFuture) && !sessionUser) {
		return res.status(401).send({ error: 'Login is required to use saved cards or save a new card.' });
	}

	let totalAmountCent = 0; // Use cents for Payment Intent amount
	let containsSubscription = false;
	const detailedCartItems: any[] = []; // For metadata context
	let stripeCustomerId: string | null = sessionUser?.stripeCustomerId || null;

	try {
		// --- Step 1: Validate items, calculate total, check for subscriptions ---
		for (const item of items) {
			// Keep existing validation...
			if (!item.priceId || typeof item.priceId !== 'string' || 
				!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0 ||
				!item.productId || typeof item.productId !== 'string' ||
				!item.name || typeof item.name !== 'string' ||
				!item.price || isNaN(parseFloat(item.price))
			) {
				console.warn("Invalid cart item structure received:", item);
				return res.status(400).send({ error: `Invalid item data passed.` });
			}

			const stripePrice = await stripe.prices.retrieve(item.priceId);
			if (!stripePrice || !stripePrice.active || !stripePrice.unit_amount) {
				return res.status(400).send({ error: `Invalid or inactive price ID: ${item.priceId}` });
			}

			if (item.isSubscription) {
				containsSubscription = true;
				if (!sessionUser || !sessionUser.id) {
					return res.status(401).send({ error: 'Login is required to purchase subscriptions.' });
				}
				if (!stripePrice.recurring) {
					return res.status(400).send({ error: `Configuration error: Price ${item.priceId} is not recurring.` });
				}
				item.recurringInterval = item.recurringInterval ?? stripePrice.recurring?.interval ?? null;
			}

			totalAmountCent += (stripePrice.unit_amount ?? 0) * item.quantity;

			// Build detailed item list for context object
			detailedCartItems.push({
				priceId: item.priceId,
				quantity: item.quantity,
				isSubscription: !!item.isSubscription,
				recurringInterval: item.recurringInterval,
				productId: item.productId,
				productName: item.name,
				price: ((stripePrice.unit_amount ?? 0) / 100).toString()
			});
		}

		// --- ADD SHIPPING & TAX TO TOTAL (BEFORE CUSTOMER HANDLING) ---
		const itemsSubtotalCent = totalAmountCent; // Keep subtotal for potential tax calculation
		let finalAmountCent = itemsSubtotalCent;
		// Fetch Shipping Rate Price from Stripe
		let shippingCostCent = 0;
		const shippingPriceId = process.env.STRIPE_SHIPPING_RATE_PRICE_ID;

		if (itemsSubtotalCent > 0 && shippingPriceId) {
			try {
				const shippingStripePrice = await stripe.prices.retrieve(shippingPriceId);
				if (shippingStripePrice && shippingStripePrice.active && shippingStripePrice.unit_amount) {
					shippingCostCent = shippingStripePrice.unit_amount; // Amount in cents
					finalAmountCent += shippingCostCent;
					console.log(`Fetched and added shipping ($${(shippingCostCent / 100).toFixed(2)}) from Price ID ${shippingPriceId}. Final amount: $${(finalAmountCent / 100).toFixed(2)}`);
				} else {
					console.warn(`Stripe Price ID ${shippingPriceId} for shipping is invalid, inactive, or has no amount. Shipping not added.`);
				}
			} catch (priceError: any) {
				console.error(`Error fetching Stripe Price ${shippingPriceId} for shipping: ${priceError.message}. Shipping not added.`);
				// Decide if this should be a fatal error preventing checkout
				// return res.status(500).send({ error: 'Could not retrieve shipping cost.' });
			}
		} else if (itemsSubtotalCent > 0) {
            console.warn("STRIPE_SHIPPING_RATE_PRICE_ID not set in environment variables. Shipping not added.");
        }

		// --- Step 1.5: Ensure Stripe Customer Exists for logged-in users (moved earlier) ---
		if (sessionUser) {
			if (!stripeCustomerId) {
				console.log(`No Stripe Customer ID found for user ${sessionUser.id}. Checking Stripe...`);
				const existingCustomers = await stripe.customers.list({ email: sessionUser.email, limit: 1 });
				if (existingCustomers.data.length > 0) {
					stripeCustomerId = existingCustomers.data[0].id;
					console.log(`Found existing Stripe Customer: ${stripeCustomerId}`);
				} else {
					console.log(`No existing Stripe customer found for ${sessionUser.email}. Creating one...`);
					const newCustomer = await stripe.customers.create({
						email: sessionUser.email,
						name: sessionUser.name || undefined,
						phone: contactInfo.phone || undefined,
						shipping: {
							name: shippingAddress.fullName,
							address: {
								line1: shippingAddress.address1, line2: shippingAddress.address2 || undefined,
								city: shippingAddress.city, state: shippingAddress.state,
								postal_code: shippingAddress.postalCode, country: shippingAddress.country,
							},
						},
						metadata: { internal_user_id: String(sessionUser.id) }
					});
					stripeCustomerId = newCustomer.id;
					console.log(`Created new Stripe Customer: ${stripeCustomerId}`);
				}
				// Update local user regardless of whether customer was found or created
				await prisma.user.update({
					where: { id: sessionUser.id }, data: { stripeCustomerId: stripeCustomerId }
				});
				sessionUser.stripeCustomerId = stripeCustomerId; // Update session
				console.log(`Updated user ${sessionUser.id} with Stripe Customer ID: ${stripeCustomerId}`);
			}
			// Validation: If selectedCardId is provided, ensure it belongs to the customer
			if (selectedCardId && stripeCustomerId) {
				try {
					const paymentMethod = await stripe.paymentMethods.retrieve(selectedCardId);
					if (paymentMethod.customer !== stripeCustomerId) {
						console.warn(`Security Warning: User ${sessionUser.id} attempted to use PaymentMethod ${selectedCardId} belonging to customer ${paymentMethod.customer}, but their Stripe Customer ID is ${stripeCustomerId}.`);
						return res.status(403).send({ error: 'Selected card does not belong to the current user.' });
					}
				} catch (pmError: any) {
					console.warn(`Error retrieving PaymentMethod ${selectedCardId} for validation: ${pmError.message}`);
					return res.status(400).send({ error: 'Invalid saved card selected.' });
				}
			}
		} // End if (sessionUser)

		// --- Step 2: Prepare Context Object (including new flags) ---
		const checkoutContext = {
			userId: sessionUser?.id || null,
			cartItems: detailedCartItems,
			contactInfo: contactInfo,
			shippingAddress: shippingAddress,
			notes: notes,
			selectedCardId: selectedCardId, // Add selectedCardId to context
			saveNewCardForFuture: saveNewCardForFuture // Add saveNewCardForFuture to context
		};

		// --- Step 2.5: Save context to temporary store and get ID ---
		console.log("Saving checkout context to temporary store...");
		const checkoutAttemptId = await saveCheckoutAttempt(checkoutContext);
		console.log(`Checkout context saved with ID: ${checkoutAttemptId}`);

		// --- Step 3: Create SetupIntent (for subs) or PaymentIntent (one-time) ---
		let clientSecret: string | null = null;

		if (containsSubscription) {
			// --- Subscription Flow -> Create SetupIntent ---
			if (!sessionUser || !stripeCustomerId) { // Should be caught earlier, but double-check
				return res.status(401).send({ error: 'Login required for subscriptions.' });
			}
			// Customer handling now done earlier
			console.log(`Creating SetupIntent for customer: ${stripeCustomerId}`);
			const setupIntent = await stripe.setupIntents.create({
				customer: stripeCustomerId,
				usage: 'on_session',
				automatic_payment_methods: { enabled: true },
				metadata: { checkoutAttemptId: checkoutAttemptId },
			});
			console.log(`SetupIntent ${setupIntent.id} created.`);
			clientSecret = setupIntent.client_secret;

		} else {
			// --- One-Time Payment Flow -> Create PaymentIntent ---
			console.log("Creating PaymentIntent for one-time purchase.");
			// Use the FINAL calculated amount including shipping/tax
			if (finalAmountCent <= 0) {
				return res.status(400).send({ error: 'Total amount including items must be positive for one-time payment.' });
			}

			const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
				amount: finalAmountCent, // <-- Use the final amount
				currency: 'usd',
				automatic_payment_methods: { enabled: true },
				metadata: { checkoutAttemptId: checkoutAttemptId },
			};

			// Add customer if logged in (enables showing saved cards in Payment Element)
			if (sessionUser && stripeCustomerId) {
				paymentIntentParams.customer = stripeCustomerId;
				console.log(`Associating PaymentIntent with customer: ${stripeCustomerId}`);

				// Add setup_future_usage if requested (and not using a saved card)
				if (saveNewCardForFuture && !selectedCardId) {
					paymentIntentParams.setup_future_usage = 'on_session';
					console.log(`Setting setup_future_usage = 'on_session' for PaymentIntent.`);
				}
			}

			// If a specific saved card is selected, pass it (optional but can help)
			// Note: PaymentElement usually handles selection, but this confirms intent.
			// if (selectedCardId && stripeCustomerId) {
			// 	paymentIntentParams.payment_method = selectedCardId;
			// }

			const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
			console.log(`PaymentIntent ${paymentIntent.id} created.`);
			clientSecret = paymentIntent.client_secret;
		}

		// --- Step 4: Return Client Secret AND Checkout Attempt ID ---
		if (!clientSecret) {
			throw new Error("Failed to initialize payment (client secret missing).");
		}
		res.send({ clientSecret: clientSecret, checkoutAttemptId: checkoutAttemptId });

	} catch (error: any) {
		console.error("Error processing /initiate-checkout:", error);
		let userMessage = 'Internal server error processing payment.';
		if (error.message === 'Failed to save checkout attempt data.') { 
			userMessage = error.message;
		} else if (error.type === 'StripeCardError') { userMessage = error.message; } 
		else if (error.type === 'StripeInvalidRequestError') { userMessage = `Invalid data provided: ${error.message}`; }
		res.status(500).send({ error: userMessage });
	}
});

// GET /api/stripe/shipping-rate
// Retrieves the current flat shipping rate amount from the Stripe Price object
router.get('/shipping-rate', async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe service is not available.' });
    }

    const shippingPriceId = process.env.STRIPE_SHIPPING_RATE_PRICE_ID;

    if (!shippingPriceId) {
        console.error("API Error: STRIPE_SHIPPING_RATE_PRICE_ID is not set in environment variables.");
        return res.status(503).json({ error: 'Shipping configuration is not available.' });
    }

    try {
        const shippingPrice = await stripe.prices.retrieve(shippingPriceId);

        if (!shippingPrice || !shippingPrice.active || typeof shippingPrice.unit_amount !== 'number') {
            console.error(`API Error: Stripe Price ${shippingPriceId} for shipping is invalid, inactive, or has no amount.`);
            return res.status(500).json({ error: 'Could not retrieve valid shipping cost details.' });
        }

        // Return amount in dollars for consistency with frontend usage
        const amountInDollars = shippingPrice.unit_amount / 100;
        res.status(200).json({ 
            id: shippingPrice.id, 
            amount: amountInDollars 
        });

    } catch (error: any) {
        console.error(`API Error fetching Stripe Price ${shippingPriceId}:`, error.message);
        if (error.type === 'StripeInvalidRequestError') {
             return res.status(404).json({ error: 'Configured shipping price ID not found.' });
        }
        res.status(500).json({ error: 'Failed to retrieve shipping rate.' });
    }
});

// --- POST /api/stripe/webhook --- 
router.post('/webhook', stripeWebhookMiddleware, async (req: Request, res: Response) => {
    // --- Add log here to see if endpoint is hit --- 
    console.log("DEBUG: /api/stripe/webhook endpoint hit!");
    // ---------------------------------------------

	if (!stripe) {
		console.error("Webhook Error: Stripe not initialized.");
		return res.status(500).send('Webhook Error: Stripe configuration issue.');
	}
	if (!webhookSecret) {
		console.error("Webhook Error: Stripe webhook secret is not configured.");
		return res.status(500).send('Webhook Error: Server configuration issue.');
	}

	const sig = req.headers['stripe-signature'];
	let event: Stripe.Event;

	try {
		console.log("DEBUG: Attempting webhook signature verification..."); // Log before verification
		event = stripe.webhooks.constructEvent(req.body, sig as string | string[], webhookSecret);
		console.log("DEBUG: Webhook signature verification successful."); // Log after verification
	} catch (err: any) {
		console.error(`Webhook signature verification failed: ${err.message}`);
		// Log the received signature and headers for comparison if needed
		// console.log("Received Signature:", sig);
		// console.log("Headers:", req.headers);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	console.log(`Received Stripe webhook event: ${event.type}`);

    // --- Log the entire event object ---
    // console.log("DEBUG: Full webhook event object:", JSON.stringify(event, null, 2));
    // ---------------------------------

    // --- Call the appropriate handler function --- 
    try {
        switch (event.type) {
            case 'setup_intent.succeeded':
                await handleSetupIntentSucceeded(event, stripe);
                break;
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event, stripe);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentIntentPaymentFailed(event, stripe);
                break;
            case 'customer.subscription.created':
                await handleCustomerSubscriptionCreated(event, stripe);
                break;
            case 'customer.subscription.deleted':
                await handleCustomerSubscriptionDeleted(event, stripe);
                break;
            case 'customer.subscription.updated':
                await handleCustomerSubscriptionUpdated(event, stripe);
                break;
            case 'invoice.paid':
                await handleInvoicePaid(event, stripe);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event, stripe);
                break;
            default:
                await handleUnhandledEvent(event);
        }
    } catch (handlerError) {
        // Catch any unexpected errors from the handlers themselves
        console.error(`Webhook Error: Uncaught error in handler for ${event.type}:`, handlerError);
        // Respond with 500 to indicate an internal server error, but still acknowledge receipt to Stripe
        return res.status(500).send('Internal server error processing webhook event.');
    }
	// Return a 200 response to acknowledge receipt of the event
	res.status(200).send();
});

export default router; 