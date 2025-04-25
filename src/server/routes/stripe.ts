import express, { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import prisma from '../db'; // Adjusted path again
import { CartItem } from '../../../src/context/CartContext'; // Adjust path as needed
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal
import { SessionUser } from '../types'; // Import SessionUser from the shared types file
import { saveCheckoutAttempt, getCheckoutAttempt, deleteCheckoutAttempt } from '../utils/checkoutTmpStore';
import { OrderStatus } from '@prisma/client'; // Import OrderStatus enum if needed for type checking

// Load environment variables
dotenv.config();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("STRIPE ROUTE Error: STRIPE_SECRET_KEY is not set.");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Define secret here

// Define expected type for /initiate-checkout request body
interface InitiateCheckoutRequest {
	items: CartItem[];
	contactInfo: { email: string; phone?: string };
	shippingAddress: {
		fullName: string;
		address1: string;
		address2?: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	};
}

// Define a type for the augmented order item including image URL
interface OrderItemWithImage {
    id: number;
    productId: string;
    productName: string;
    quantity: number;
    price: Decimal; // Prisma Decimal type
    imageUrl: string | null;
}

const router: Router = express.Router();

// Middleware for raw body specific to webhook
const stripeWebhookMiddleware = express.raw({ type: 'application/json' });

// GET /api/stripe/payment-intent/:paymentIntentId
// Retrieves the status of a Stripe PaymentIntent AND attempts to find associated order details with images
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
        let fetchedOrderFromDb = null;
        const checkoutAttemptId = paymentIntent.metadata?.checkoutAttemptId;

        if (checkoutAttemptId) {
            console.log(`PI Route: Found checkoutAttemptId ${checkoutAttemptId}, looking for Order...`);
            fetchedOrderFromDb = await prisma.order.findUnique({
                where: { checkoutAttemptId: checkoutAttemptId },
                include: {
                    items: { 
                        select: {
                            id: true,
                            productId: true,
                            productName: true,
                            quantity: true,
                            price: true
                        }
                    } 
                }
            });
        }

        let finalOrderDetails: any = null; // Initialize as null

        if (fetchedOrderFromDb) {
            finalOrderDetails = { ...fetchedOrderFromDb, items: [] }; // Copy base order details

            if (fetchedOrderFromDb.items.length > 0) {
                console.log(`PI Route: Found Order ${fetchedOrderFromDb.id}. Fetching product images...`);
                // Use explicit type for the augmented items array
                const itemsWithImages: OrderItemWithImage[] = await Promise.all(
                    fetchedOrderFromDb.items.map(async (item) => {
                        let imageUrl: string | null = null;
                        try {
                            const stripeProduct = await stripe!.products.retrieve(item.productId);
                            imageUrl = stripeProduct?.images?.[0] || null; 
                        } catch (prodError: any) {
                            console.warn(`Could not fetch Stripe product ${item.productId} for order ${fetchedOrderFromDb.id}: ${prodError.message}`);
                        }
                        // Price from DB is already Decimal, no need to parse
                        return { ...item, price: item.price, imageUrl }; 
                    })
                );
                finalOrderDetails.items = itemsWithImages; // Assign augmented items
                console.log(`PI Route: Added image URLs to order items.`);
            } else {
                 console.log(`PI Route: Found Order ${fetchedOrderFromDb.id} but it has no items.`);
            }
        } else if (checkoutAttemptId) {
             console.log(`PI Route: Order not found for checkoutAttemptId ${checkoutAttemptId}.`);
        }

        res.status(200).json({
            stripeStatus: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            id: paymentIntent.id,
            orderDetails: finalOrderDetails // Send the potentially augmented order details
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
// Retrieves the status of a Stripe SetupIntent AND attempts to find associated order/subscription details with images
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
        let fetchedOrderFromDb = null;
        let subscriptionDetails = null;
        const checkoutAttemptId = setupIntent.metadata?.checkoutAttemptId;

        if (checkoutAttemptId) {
            console.log(`SI Route: Found checkoutAttemptId ${checkoutAttemptId}, looking for Order/Subscription...`);
            fetchedOrderFromDb = await prisma.order.findUnique({
                 where: { checkoutAttemptId: checkoutAttemptId },
                include: {
                    items: { 
                         select: {
                            id: true,
                            productId: true,
                            productName: true,
                            quantity: true,
                            price: true
                        }
                    } 
                }
            });
            subscriptionDetails = await prisma.subscription.findFirst({
                 where: { checkoutAttemptId: checkoutAttemptId },
            });
        }

        let finalOrderDetails: any = null; // Initialize as null

        if (fetchedOrderFromDb) {
            finalOrderDetails = { ...fetchedOrderFromDb, items: [] }; // Copy base order details
            
            if (fetchedOrderFromDb.items.length > 0) {
                 console.log(`SI Route: Found Order ${fetchedOrderFromDb.id}. Fetching product images...`);
                 // Use explicit type for the augmented items array
                 const itemsWithImages: OrderItemWithImage[] = await Promise.all(
                    fetchedOrderFromDb.items.map(async (item) => {
                        let imageUrl: string | null = null;
                        try {
                            const stripeProduct = await stripe!.products.retrieve(item.productId);
                            imageUrl = stripeProduct?.images?.[0] || null; 
                        } catch (prodError: any) {
                            console.warn(`Could not fetch Stripe product ${item.productId} for order ${fetchedOrderFromDb.id}: ${prodError.message}`);
                        }
                        return { ...item, price: item.price, imageUrl }; 
                    })
                );
                finalOrderDetails.items = itemsWithImages; // Assign augmented items
                console.log(`SI Route: Added image URLs to order items.`);
            } else {
                 console.log(`SI Route: Found Order ${fetchedOrderFromDb.id} but it has no items.`);
            }
        }

        if (subscriptionDetails) console.log(`SI Route: Found Subscription ${subscriptionDetails.id}`);
        if (checkoutAttemptId && (!finalOrderDetails || !subscriptionDetails) ) {
             console.log(`SI Route: Order or Subscription not found for checkoutAttemptId ${checkoutAttemptId}.`);
        }
        
        res.status(200).json({
            stripeStatus: setupIntent.status,
            id: setupIntent.id,
            orderDetails: finalOrderDetails, // Send the potentially augmented order details
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

	const { items, contactInfo, shippingAddress } = req.body as InitiateCheckoutRequest;
	const sessionUser = req.session.user as SessionUser | undefined;

	// --- Basic Validations (keep existing) ---
	if (!items || !Array.isArray(items) || items.length === 0 || !contactInfo || !shippingAddress) {
		return res.status(400).send({ error: 'Invalid request body: missing items, contact, or shipping info.' });
	}
	if (!contactInfo.email || !shippingAddress.fullName || !shippingAddress.address1 ||
		!shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode || !shippingAddress.country) {
		return res.status(400).send({ error: 'Missing required contact or shipping fields.' });
	}

	let totalAmountCent = 0; // Use cents for Payment Intent amount
	let containsSubscription = false;
	const detailedCartItems: any[] = []; // For metadata context (still needed to build context object)

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

		// --- Step 2: Prepare Context Object (No longer stringified for metadata) ---
		const checkoutContext = {
			userId: sessionUser?.id || null,
			cartItems: detailedCartItems,
			contactInfo: contactInfo,
			shippingAddress: shippingAddress,
		};
		// --- Removed contextString = JSON.stringify(checkoutContext); ---

		// --- Step 2.5: Save context to temporary store and get ID ---
		console.log("Saving checkout context to temporary store...");
		const checkoutAttemptId = await saveCheckoutAttempt(checkoutContext);
		console.log(`Checkout context saved with ID: ${checkoutAttemptId}`);

		// --- Step 3: Create SetupIntent (for subs) or PaymentIntent (one-time) ---
		let clientSecret: string | null = null;

		if (containsSubscription) {
			// --- Subscription Flow -> Create SetupIntent ---
			if (!sessionUser || !sessionUser.id) { // Should be caught earlier, but double-check
				return res.status(401).send({ error: 'Login required for subscriptions.' });
			}

			// Find or Create Stripe Customer (keep existing logic)
			let stripeCustomerId = sessionUser.stripeCustomerId;
			if (!stripeCustomerId) {
				const existingCustomers = await stripe.customers.list({ email: sessionUser.email, limit: 1 });
				if (existingCustomers.data.length > 0) {
					stripeCustomerId = existingCustomers.data[0].id;
				} else {
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
				}
				// Update local user
				await prisma.user.update({
					where: { id: sessionUser.id }, data: { stripeCustomerId: stripeCustomerId }
				});
				sessionUser.stripeCustomerId = stripeCustomerId; // Update session
			}

			// Create Setup Intent with only checkoutAttemptId in metadata
			console.log(`Creating SetupIntent for customer: ${stripeCustomerId}`);
			const setupIntent = await stripe.setupIntents.create({
				customer: stripeCustomerId,
				usage: 'on_session',
				automatic_payment_methods: { enabled: true },
				metadata: { checkoutAttemptId: checkoutAttemptId }, // <-- Use new ID
			});
			console.log(`SetupIntent ${setupIntent.id} created.`);
			clientSecret = setupIntent.client_secret;

		} else {
			// --- One-Time Payment Flow -> Create PaymentIntent ---
			console.log("Creating PaymentIntent for one-time purchase.");
			if (totalAmountCent <= 0) {
				return res.status(400).send({ error: 'Total amount must be positive for one-time payment.' });
		}

		// Create Payment Intent with only checkoutAttemptId in metadata
		const paymentIntent = await stripe.paymentIntents.create({
				amount: totalAmountCent,
			currency: 'usd', 
				automatic_payment_methods: { enabled: true },
				metadata: { checkoutAttemptId: checkoutAttemptId }, // <-- Use new ID
				// customer: sessionUser?.stripeCustomerId || undefined, // Optional customer link
			});
			console.log(`PaymentIntent ${paymentIntent.id} created.`);
			clientSecret = paymentIntent.client_secret;
		}

		// --- Step 4: Return Client Secret AND Checkout Attempt ID ---
		if (!clientSecret) {
			throw new Error("Failed to initialize payment (client secret missing).");
		}
		// Return both values to the frontend
		res.send({ clientSecret: clientSecret, checkoutAttemptId: checkoutAttemptId });

	} catch (error: any) {
		console.error("Error processing /initiate-checkout:", error);
		let userMessage = 'Internal server error processing payment.';
		if (error.message === 'Failed to save checkout attempt data.') { // Catch error from saveCheckoutAttempt
			userMessage = error.message;
		} else if (error.type === 'StripeCardError') { userMessage = error.message; }
		else if (error.type === 'StripeInvalidRequestError') { userMessage = `Invalid data provided: ${error.message}`; }
		res.status(500).send({ error: userMessage });
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

	switch (event.type) {
		case 'setup_intent.succeeded':
			const setupIntent = event.data.object as Stripe.SetupIntent;
			console.log(`---> Handling ${event.type} for SetupIntent ID: ${setupIntent.id}`);

			// --- Re-enabled Logic Using Temporary Store ---
			try {
				// --- 1. Extract data from SetupIntent --- 
				const customerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : null;
				const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : null;
				// Get checkoutAttemptId from metadata
				const checkoutAttemptId = setupIntent.metadata?.checkoutAttemptId;

				// --- 2. Validate extracted data --- 
				if (!customerId || !paymentMethodId) {
					console.error(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Missing customer ID or payment method ID.`);
					break; // Cannot proceed without customer/payment method
				}
				if (!checkoutAttemptId) {
					console.error(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Missing checkoutAttemptId metadata.`);
					break; // Cannot proceed without context ID
				}

				// --- 3. Retrieve Context from Temporary Store --- 
				console.log(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Retrieving context using ID: ${checkoutAttemptId}`);
				const context = await getCheckoutAttempt(checkoutAttemptId);

				if (!context) {
					console.error(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Failed to retrieve checkout context for ID: ${checkoutAttemptId}. Data might have expired or been deleted.`);
					// Potentially log more details or send an alert
					break; // Cannot proceed without context
				}
				console.log(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Successfully retrieved context.`);

				const { userId, cartItems, contactInfo, shippingAddress } = context;

				if (!userId || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !contactInfo || !shippingAddress) {
					console.error(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Invalid context structure retrieved for ID: ${checkoutAttemptId}.`);
					break;
				}

				// --- 4. Prepare for Stripe Subscription Creation (using retrieved context) --- 
				const subscriptionItems = cartItems
					.filter((item: any) => item.isSubscription)
					.map((item: any) => ({ price: item.priceId, quantity: item.quantity }));

				const oneTimeItems = cartItems
					.filter((item: any) => !item.isSubscription)
					.map((item: any) => ({ price: item.priceId, quantity: item.quantity }));

				if (subscriptionItems.length === 0) {
					console.warn(`Webhook (SetupIntent Succeeded ${setupIntent.id}): No subscription items found in context ID: ${checkoutAttemptId}. Skipping subscription creation.`);
					// If no subscription items, maybe attempt to delete the attempt data?
					await deleteCheckoutAttempt(checkoutAttemptId);
					break;
				}

				const subscriptionCreateParams: Stripe.SubscriptionCreateParams = {
					customer: customerId,
					items: subscriptionItems,
					default_payment_method: paymentMethodId,
					metadata: { userId: String(userId) } // Pass userId along to sub metadata too
				};

				if (oneTimeItems.length > 0) {
					subscriptionCreateParams.add_invoice_items = oneTimeItems;
				}

				// --- 5. Create Stripe Subscription --- 
				console.log(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Attempting to create Stripe Subscription...`);
				const stripeSubscription = await stripe.subscriptions.create(subscriptionCreateParams);
				console.log(`Webhook (SetupIntent Succeeded ${setupIntent.id}): Created Stripe Subscription ${stripeSubscription.id}`);

				// --- 6. Create Local Records in Transaction --- 
				try {
					await prisma.$transaction(async (tx) => {
						console.log(`    Webhook (SetupIntent Succeeded ${setupIntent.id}): Starting DB transaction...`);
						
						// a) Create Subscription Record
						const subEndDateRaw = (stripeSubscription as any).current_period_end;
						const subEndDate = typeof subEndDateRaw === 'number' ? new Date(subEndDateRaw * 1000) : undefined;
						const firstSubItemContext = cartItems.find((item: any) => item.isSubscription);
						
						const newLocalSub = await tx.subscription.create({
							data: {
								userId: userId,
								stripeSubscriptionId: stripeSubscription.id,
								stripePriceId: firstSubItemContext?.priceId || 'unknown',
								status: stripeSubscription.status,
								interval: firstSubItemContext?.recurringInterval || 'unknown',
								currentPeriodEnd: subEndDate,
								cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
								collectionPaused: (stripeSubscription as any).pause_collection?.behavior === 'void',
								checkoutAttemptId: checkoutAttemptId // <-- Save the ID
							}
						});
						console.log(`        Created local Subscription record: ${newLocalSub.id}`);

						// b) Create Order Record (linking to subscription)
						let orderTotalAmount = 0;
						cartItems.forEach((item: any) => {
							const price = parseFloat(item.price);
							if (!isNaN(price)) {
								orderTotalAmount += price * item.quantity;
							}
						});
						const totalAmountDecimal = new Decimal(orderTotalAmount.toFixed(2));
						
						const newOrder = await tx.order.create({
							data: {
								userId: userId,
								subscriptionId: newLocalSub.id,
								totalAmount: totalAmountDecimal, 
								// Use OrderStatus enum value
								status: 'PAID', // Assume PAID because SetupIntent succeeded
								contactEmail: contactInfo.email,
								contactPhone: contactInfo.phone || null,
								shippingName: shippingAddress.fullName,
								shippingAddress1: shippingAddress.address1,
								shippingAddress2: shippingAddress.address2 || null,
								shippingCity: shippingAddress.city,
								shippingState: shippingAddress.state,
								shippingPostalCode: shippingAddress.postalCode,
								shippingCountry: shippingAddress.country,
								checkoutAttemptId: checkoutAttemptId, // <-- Save the ID
								items: {
									create: cartItems.map((item: any) => ({
										productId: item.productId,
										productName: item.productName || 'Unknown',
										quantity: item.quantity,
										price: new Decimal(item.price || 0), 
									})),
								},
							},
							select: { id: true }
						});
						console.log(`        Created local Order record: ${newOrder.id} linked to Sub ${newLocalSub.id}`);
					
					}); // End Transaction
					console.log(`    Webhook (SetupIntent Succeeded ${setupIntent.id}): DB transaction completed.`);
				
					// --- 7. Delete Temporary Context Data --- 
					console.log(`    Webhook (SetupIntent Succeeded ${setupIntent.id}): Deleting temporary context ID: ${checkoutAttemptId}`);
					await deleteCheckoutAttempt(checkoutAttemptId);
					console.log(`    Webhook (SetupIntent Succeeded ${setupIntent.id}): Temporary context deleted.`);
				
				} catch (txError) {
					console.error(`Webhook (SetupIntent Succeeded ${setupIntent.id}): DB transaction failed:`, txError);
					// If the transaction fails, the Stripe subscription still exists.
					// Also, the temporary context data was NOT deleted.
					// Need robust error handling / retry / notification logic here.
				}

			} catch (error) {
				console.error(`Webhook Error (SetupIntent Succeeded ${setupIntent.id}): Error processing event:`, error);
				// Don't send 500 to Stripe unless it's a webhook signature issue
			}
			// --- End Re-enabled Logic ---
			break;

		case 'payment_intent.succeeded':
			const paymentIntent = event.data.object as Stripe.PaymentIntent;
			console.log(`---> Handling ${event.type} for PaymentIntent ID: ${paymentIntent.id}`);

			// --- Re-enabled Logic Using Temporary Store ---
			try {
				// --- 1. Extract checkoutAttemptId --- 
				const checkoutAttemptId = paymentIntent.metadata?.checkoutAttemptId;
				if (!checkoutAttemptId) {
					console.warn(`Webhook (PI Succeeded ${paymentIntent.id}): Missing checkoutAttemptId metadata. Cannot create order.`);
					// If this PI wasn't created through our checkout flow, we can't link it easily.
					break;
				}

				// --- 2. Retrieve Context --- 
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Retrieving context using ID: ${checkoutAttemptId}`);
				const context = await getCheckoutAttempt(checkoutAttemptId);
				if (!context) {
					console.error(`Webhook (PI Succeeded ${paymentIntent.id}): Failed to retrieve checkout context for ID: ${checkoutAttemptId}.`);
					break;
				}
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Successfully retrieved context.`);

				const { userId, cartItems, contactInfo, shippingAddress } = context;

				if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !contactInfo || !shippingAddress) {
					console.error(`Webhook (PI Succeeded ${paymentIntent.id}): Invalid context structure retrieved for ID: ${checkoutAttemptId}.`);
					break;
				}

				// --- 3. Check if One-Time Purchase (Crucial) --- 
				const containsSubscription = cartItems.some((item: any) => item.isSubscription);
				if (containsSubscription) {
					console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Context ID ${checkoutAttemptId} indicates subscription involved. Order creation handled by setup_intent.succeeded. Skipping PI handler.`);
					// IMPORTANT: If subscription items were present, the SI handler should have created the order.
					// We should delete the temp context here ONLY if we are sure the SI handler succeeded.
					// For simplicity now, let the SI handler manage deletion.
					break; 
				}

				// --- 4. Create Order for One-Time Purchase --- 
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Processing as one-time purchase order using context ID ${checkoutAttemptId}.`);
				const totalAmountDecimal = new Decimal(paymentIntent.amount / 100);

				// Optional: Check if order already exists with this checkoutAttemptId to prevent duplicates
				const existingOrder = await prisma.order.findUnique({ where: { checkoutAttemptId } });
				if (existingOrder) {
					console.warn(`Webhook (PI Succeeded ${paymentIntent.id}): Order with checkoutAttemptId ${checkoutAttemptId} already exists (ID: ${existingOrder.id}). Skipping creation.`);
					// Delete the temporary context data even if duplicate order found
					await deleteCheckoutAttempt(checkoutAttemptId);
					break;
				}

				const newOrder = await prisma.order.create({ // Use transaction later if needed
					data: {
						userId: userId, // Use userId from context
						totalAmount: totalAmountDecimal,
						// Use OrderStatus enum value
						status: 'PAID',
						// Use contact/shipping info from context
						contactEmail: contactInfo.email,
						contactPhone: contactInfo.phone || null,
						shippingName: shippingAddress.fullName,
						shippingAddress1: shippingAddress.address1,
						shippingAddress2: shippingAddress.address2 || null,
						shippingCity: shippingAddress.city,
						shippingState: shippingAddress.state,
						shippingPostalCode: shippingAddress.postalCode,
						shippingCountry: shippingAddress.country,
						checkoutAttemptId: checkoutAttemptId, // <-- Save the ID
						items: {
							create: cartItems.map((item: any) => ({
								productId: item.productId,
								productName: item.productName || 'Unknown',
								quantity: item.quantity,
								price: new Decimal(item.price || 0), 
							})),
						},
					},
					select: { id: true }
				});
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Created one-time Order: ${newOrder.id} with checkoutAttemptId ${checkoutAttemptId}.`);

				// --- 5. Delete Temporary Context Data --- 
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Deleting temporary context ID: ${checkoutAttemptId}`);
				await deleteCheckoutAttempt(checkoutAttemptId);
				console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Temporary context deleted.`);

			} catch (error) {
				console.error(`Webhook Error (PI Succeeded ${paymentIntent.id}): Error creating order:`, error);
				// If order creation fails, the temporary context is NOT deleted.
				// Need retry/notification logic.
			}
			// --- End Re-enabled Logic ---
			break;

		case 'payment_intent.payment_failed':
			const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
			console.log(`Payment failed for PaymentIntent: ${failedPaymentIntent.id}`);
			// TODO: Update order status to FAILED or notify user.
			break;

		// --- Handle other subscription-related events --- 
		case 'customer.subscription.created':
			const createdSub = event.data.object as Stripe.Subscription;
			console.log(`---> Handling ${event.type} for Sub ID: ${createdSub.id}, Status: ${createdSub.status}`);
			// No action needed here in the new flow, as activation/creation is handled
			// by invoice.paid (via pending context) or customer.subscription.updated.
			// We could potentially create an 'incomplete' local record here if desired,
			// but the current logic handles creation upon activation.
			break;

		case 'customer.subscription.deleted':
			console.log(`Subscription deleted event received: ${(event.data.object as Stripe.Subscription).id}`);
			// Find local sub by stripeSubscriptionId and update status to 'canceled' or similar
			try {
				await prisma.subscription.updateMany({
					where: { stripeSubscriptionId: (event.data.object as Stripe.Subscription).id },
					data: { status: 'canceled' } // Or maybe a dedicated deleted status?
				});
				console.log(`Marked local subscription as canceled: ${(event.data.object as Stripe.Subscription).id}`);
			} catch (dbError) {
				console.error(`Failed to mark local subscription as canceled: ${(event.data.object as Stripe.Subscription).id}`, dbError);
			}
			break;

		case 'customer.subscription.updated':
			const updatedSubEventData = event.data.object as Stripe.Subscription;
			console.log(`---> Handling ${event.type} for Sub ID: ${updatedSubEventData.id}`);
			console.log(`    Incoming Status: ${updatedSubEventData.status}`);
			console.log(`    Incoming cancelAtPeriodEnd: ${updatedSubEventData.cancel_at_period_end}`);
			console.log(`    Incoming current_period_end (raw): ${(updatedSubEventData as any).current_period_end}`);
			console.log(`    Incoming pause_collection: ${JSON.stringify((updatedSubEventData as any).pause_collection)}`);

			try {
				// Attempt to find existing local subscription
				console.log(`    Searching for existing local subscription with Stripe ID: ${updatedSubEventData.id}`);
				const existingLocalSub = await prisma.subscription.findUnique({
					where: { stripeSubscriptionId: updatedSubEventData.id },
				});

				if (existingLocalSub) {
					// --- Update Existing Subscription ---
					console.log(`    Found local subscription ID: ${existingLocalSub.id}. Updating...`);
					const periodEndTimestamp = (updatedSubEventData as any).current_period_end;
					const updateData: any = {
						status: updatedSubEventData.status,
						cancelAtPeriodEnd: updatedSubEventData.cancel_at_period_end,
						collectionPaused: (updatedSubEventData as any).pause_collection?.behavior === 'void',
						currentPeriodEnd: typeof periodEndTimestamp === 'number'
							? new Date(periodEndTimestamp * 1000)
							: existingLocalSub.currentPeriodEnd, // Keep existing if null/undefined comes in
					};
					if (updateData.currentPeriodEnd === undefined) delete updateData.currentPeriodEnd;

					console.log(`    Attempting DB update for ${existingLocalSub.id} with data:`, JSON.stringify(updateData));
					const updateResult = await prisma.subscription.update({
						where: { id: existingLocalSub.id },
						data: updateData,
					});
					console.log(`    DB update successful for ${existingLocalSub.id}. New status: ${updateResult.status}`);

				} else {
					// --- Local Subscription Not Found --- 
					console.warn(`    WARNING: Local subscription not found for Stripe ID ${updatedSubEventData.id} during update. Creation is handled by setup_intent.succeeded.`);
					// --- REMOVED Fallback Creation Logic --- 
				}

			} catch (dbError) {
				console.error(`---> ERROR during ${event.type} DB processing for ${updatedSubEventData.id}:`, dbError);
			}
			break;

		// --- Invoice Events (Mainly for Renewals Now) ---
		case 'invoice.paid':
			const paidInvoice = event.data.object as Stripe.Invoice;
			const subIdForInvoice = typeof (paidInvoice as any).subscription === 'string' ? (paidInvoice as any).subscription : null;
			
			console.log(`---> Handling invoice.paid for Invoice ID: ${paidInvoice.id}`);
			console.log(`    Related Subscription ID: ${subIdForInvoice}`);
			console.log(`    Invoice Status: ${paidInvoice.status}`);
			console.log(`    Billing Reason: ${paidInvoice.billing_reason}`);

			// --- Focus on Renewals --- 
			if (paidInvoice.status === 'paid' && subIdForInvoice && 
				(paidInvoice.billing_reason === 'subscription_cycle' || paidInvoice.billing_reason === 'subscription_update')) 
			{
				console.log(`    Processing as subscription renewal/update payment.`);
				try {
					// --- Removed PendingOrderContext Check --- 
					
					// --- Renewal Logic --- 
					await prisma.$transaction(async (tx) => {
						// 1. Find local subscription
						const localSubscription = await tx.subscription.findUnique({
							where: { stripeSubscriptionId: subIdForInvoice },
							include: { user: true }
						});
						if (!localSubscription) { 
							// Log error but don't throw inside transaction to avoid rollback if possible?
							// Or maybe throwing is correct? Decide on desired behavior.
							console.error(`    ERROR: Local subscription ${subIdForInvoice} not found for renewal.`);
							// Consider throwing an error here if finding the subscription is critical
							// throw new Error(`Local subscription ${subIdForInvoice} not found for renewal.`);
							return; // Exit transaction safely if sub not found
						}
						console.log(`    Found local subscription ID: ${localSubscription.id} for renewal.`);

						// 2. Fetch latest subscription data from Stripe for accurate period end
						let stripeSubscription: Stripe.Subscription | null = null;
						try {
							stripeSubscription = await stripe!.subscriptions.retrieve(subIdForInvoice);
						} catch (stripeError) {
							console.error(`    ERROR: Failed to retrieve Stripe subscription ${subIdForInvoice} during renewal:`, stripeError);
							// Again, decide if we should throw to rollback or just log and potentially skip updates
							return; // Exit transaction safely
						}
						console.log(`    Fetched Stripe Sub Status: ${stripeSubscription.status}, Period End: ${(stripeSubscription as any).current_period_end}`);
						const periodEndTimestamp = (stripeSubscription as any).current_period_end;

						// 3. Update local subscription (status, period end)
						console.log(`    ---> Inside Renewal Transaction: Updating local subscription ${localSubscription.id}`);
						await tx.subscription.update({
							where: { id: localSubscription.id },
							data: {
								status: stripeSubscription.status,
								currentPeriodEnd: typeof periodEndTimestamp === 'number' ? new Date(periodEndTimestamp * 1000) : localSubscription.currentPeriodEnd, // Keep existing if Stripe is null
								cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
							}
						});
						console.log(`    ---> Inside Renewal Transaction: Local subscription updated.`);
						
						// 4. Create Renewal Order 
						console.log(`    ---> Inside Renewal Transaction: Creating renewal Order for Invoice ${paidInvoice.id}`);
						const lineItem = paidInvoice.lines.data[0];
						const lineItemPrice = (lineItem as any)?.price;
						if (!lineItem || !lineItemPrice || typeof lineItemPrice.unit_amount !== 'number') {
							console.warn(`    WARNING: Invoice ${paidInvoice.id} renewal line item invalid. Skipping order creation.`);
							return; // Exit transaction block if line item is invalid
						}
						await tx.order.create({
							data: {
								userId: localSubscription.userId,
								subscriptionId: localSubscription.id,
								totalAmount: new Decimal(paidInvoice.amount_paid / 100),
								status: 'PAID',
								contactEmail: paidInvoice.customer_email || localSubscription.user?.email || 'unknown',
								shippingName: paidInvoice.customer_name || localSubscription.user?.name || 'N/A',
								shippingAddress1: paidInvoice.customer_shipping?.address?.line1 || 'N/A',
								shippingCity: paidInvoice.customer_shipping?.address?.city || 'N/A',
								shippingState: paidInvoice.customer_shipping?.address?.state || 'N/A',
								shippingPostalCode: paidInvoice.customer_shipping?.address?.postal_code || 'N/A',
								shippingCountry: paidInvoice.customer_shipping?.address?.country || 'N/A',
								items: {
									create: [{
										productId: typeof lineItemPrice.product === 'string' ? lineItemPrice.product : 'unknown',
										productName: lineItem.description || 'Subscription Renewal',
										quantity: lineItem.quantity || 1,
										price: new Decimal(lineItemPrice.unit_amount / 100),
									}]
								}
							}
						});
						console.log(`    ---> Inside Renewal Transaction: Renewal Order created successfully.`);
					}); // End Renewal Transaction
	} catch (error: any) {
					// Catch errors during the renewal transaction
					console.error(`---> ERROR processing renewal transaction for invoice ${paidInvoice.id}:`, error);
				}
			} else {
				// Log why this invoice.paid event is being ignored
				console.log(`    Invoice ${paidInvoice.id} not processed: Status=${paidInvoice.status}, SubID=${subIdForInvoice}, Reason=${paidInvoice.billing_reason}`);
			}
			break;

		case 'invoice.payment_failed':
			const failedInvoice = event.data.object as Stripe.Invoice;
			// Use 'any' cast for subscription ID access, with type check
			const failedSubId = typeof (failedInvoice as any).subscription === 'string' ? (failedInvoice as any).subscription : null;

			console.log(`Invoice payment failed: ${failedInvoice.id}, Subscription: ${failedSubId}`);

			if (failedSubId) {
				try {
					// Find the relevant local subscription
					const localSubscription = await prisma.subscription.findUnique({
						where: { stripeSubscriptionId: failedSubId },
					});

					if (localSubscription) {
						// Update the status - use 'past_due' or 'unpaid' depending on your model/preference
						// Stripe might also set the subscription status directly, which customer.subscription.updated handles,
						// but explicitly setting it here on failure is good practice.
						const updatedStatus = 'past_due'; // Or 'unpaid', 'inactive' etc.
						await prisma.subscription.update({
							where: { id: localSubscription.id },
							data: { status: updatedStatus },
						});
						console.log(`Updated local subscription ${localSubscription.id} status to ${updatedStatus} due to failed invoice ${failedInvoice.id}`);

						// TODO: Add user notification logic here (e.g., send email)

					} else {
						console.warn(`Webhook Warning: Received invoice.payment_failed for non-existent local subscription. Stripe Sub ID: ${failedSubId}`);
					}
				} catch (error) {
					console.error(`Webhook Error: Failed processing invoice.payment_failed for subscription ${failedSubId}:`, error);
				}
			} else {
				console.log(`Invoice ${failedInvoice.id} payment failed, but it was not linked to a subscription.`);
			}
			break;

		default:
			console.log(`Unhandled webhook event type: ${event.type}`);
	}

	// Return a 200 response to acknowledge receipt of the event
	res.status(200).send();
});

export default router; 