import express, { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import prisma from '../db'; // Adjusted path again
import { CartItem } from '../../../src/context/CartContext'; // Adjust path as needed
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal

// Load environment variables
dotenv.config();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("STRIPE ROUTE Error: STRIPE_SECRET_KEY is not set.");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Define secret here

// Define expected type for the user object in the session
interface SessionUser {
	id: number;
	email: string;
	name?: string | null;
	stripeCustomerId?: string | null;
	// Add other relevant user fields if needed
}

// Define expected type for /create-payment-intent request body
interface CreatePaymentIntentRequest {
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

const router: Router = express.Router();

// --- Middleware to handle raw body for webhook verification ---
// This needs to run *before* express.json() for the webhook route specifically.
// Consider moving webhook logic to its own file or applying middleware selectively.
const stripeWebhookMiddleware = express.raw({ type: 'application/json' });

// GET /api/stripe/payment-intent/:paymentIntentId
// Retrieves the status of a Stripe PaymentIntent
router.get('/payment-intent/:paymentIntentId', async (req: Request, res: Response) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe service is not available.' });
    }

    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing Payment Intent ID.' });
    }

    try {
        // Retrieve the PaymentIntent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Send back relevant information (e.g., status, amount)
        res.status(200).json({
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            id: paymentIntent.id,
            // Add any other relevant fields you might need on the frontend
        });

    } catch (error: any) {
        console.error(`Error fetching Payment Intent ${paymentIntentId}:`, error.message);
        // Provide a more specific error message if possible
        if (error.type === 'StripeInvalidRequestError') {
             return res.status(404).json({ error: 'Payment Intent not found or invalid ID.' });
        }
        res.status(500).json({ error: 'Failed to retrieve payment intent status.' });
    }
});

// POST /api/stripe/create-payment-intent - Create a new PaymentIntent
router.post('/create-payment-intent', async (req: Request, res: Response) => {
	if (!stripe) {
		return res.status(500).send({ error: 'Stripe is not configured.' });
	}

	const { items, contactInfo, shippingAddress } = req.body as CreatePaymentIntentRequest;
	const sessionUser = req.session.user as SessionUser | undefined;

	if (!items || !Array.isArray(items) || items.length === 0 || !contactInfo || !shippingAddress) {
		return res.status(400).send({ error: 'Invalid request body: missing items, contact, or shipping info.' });
	}

	// Basic validation for contact/shipping (can be expanded)
	if (!contactInfo.email || !shippingAddress.fullName || !shippingAddress.address1 ||
		!shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode || !shippingAddress.country) {
		return res.status(400).send({ error: 'Missing required contact or shipping fields.' });
	}

	let totalAmount = 0;
	let containsSubscription = false;
	const metadataCartItems: any[] = []; // For storing structured cart data in metadata

	try {
		// Calculate total, check for subscriptions, and build metadata structure
		for (const item of items) {
			// Basic validation
			if (!item.priceId || typeof item.priceId !== 'string' || 
			    !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
				console.warn("Invalid cart item structure received:", item);
				// Consider sending a more specific error
				return res.status(400).send({ error: `Invalid item data passed.` });
			}

			// Fetch price from Stripe to ensure validity and get amount
			const price = await stripe.prices.retrieve(item.priceId);

			if (!price || !price.active || !price.unit_amount) {
				console.warn(`Price ID ${item.priceId} not found, inactive, or has no amount.`);
				return res.status(400).send({ error: `Invalid or inactive price ID: ${item.priceId}` });
			}

			// --- Subscription Check --- 
			if (item.isSubscription) {
				containsSubscription = true;
				// Ensure user is logged in (now checking asserted type)
				if (!sessionUser || !sessionUser.id || !sessionUser.email) {
					return res.status(401).send({ error: 'Login is required to purchase subscriptions.' });
				}
				// Ensure the price IS actually recurring on Stripe side
				if (!price.recurring) {
					console.error(`Cart item ${item.priceId} marked as subscription but Stripe price is not recurring.`);
					return res.status(400).send({ error: `Configuration error for price ID: ${item.priceId}` });
				}
			}

			totalAmount += (price.unit_amount ?? 0) * item.quantity;
			metadataCartItems.push({
				priceId: item.priceId,
				quantity: item.quantity,
				isSubscription: !!item.isSubscription,
				recurringInterval: item.recurringInterval || null,
				productId: item.productId,
				productName: item.name
			});
		}

		if (totalAmount <= 0) {
			// Allow $0 if it's purely a trial subscription setup? Stripe might require a minimum.
			// For now, enforce positive amount, adjust if free trials are needed.
			return res.status(400).send({ error: 'Calculated total amount must be positive.' });
		}

		// --- Customer and Payment Intent Params --- 
		const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
			amount: totalAmount, 
			currency: 'usd', 
			automatic_payment_methods: {
				enabled: true,
			},
			metadata: {
				cart_items: JSON.stringify(metadataCartItems),
				contains_subscription: String(containsSubscription),
				userId: sessionUser?.id ? String(sessionUser.id) : null,
				// Store contact/shipping info (ensure values are strings)
				contactEmail: contactInfo.email,
				contactPhone: contactInfo.phone || null,
				shippingName: shippingAddress.fullName,
				shippingAddress1: shippingAddress.address1,
				shippingAddress2: shippingAddress.address2 || null,
				shippingCity: shippingAddress.city,
				shippingState: shippingAddress.state,
				shippingPostalCode: shippingAddress.postalCode,
				shippingCountry: shippingAddress.country
			}
		};

		if (containsSubscription) {
			// Ensure sessionUser is defined here (already checked above, but good practice)
			if (!sessionUser) {
				console.error("Subscription detected but user session is missing.");
				return res.status(500).send({ error: 'User session error during subscription checkout.' });
			}

			let stripeCustomerId = sessionUser.stripeCustomerId; // Now correctly typed

			// 1. Find or Create Stripe Customer
			if (!stripeCustomerId) {
				const existingCustomers = await stripe.customers.list({ email: sessionUser.email, limit: 1 });
				if (existingCustomers.data.length > 0) {
					stripeCustomerId = existingCustomers.data[0].id;
				} else {
					const newCustomer = await stripe.customers.create({
						email: sessionUser.email,
						name: sessionUser.name || undefined,
						metadata: {
							internal_user_id: String(sessionUser.id) // Ensure metadata value is string
						}
					});
					stripeCustomerId = newCustomer.id;
				}

				// 2. Update local User record with Stripe Customer ID
				try {
					await prisma.user.update({
						where: { id: sessionUser.id },
						data: { stripeCustomerId: stripeCustomerId }
					});
				} catch (dbError) {
					console.error(`Failed to update user ${sessionUser.id} with stripeCustomerId ${stripeCustomerId}:`, dbError);
				}
			}

			if (!stripeCustomerId) {
				// Handle case where customer ID couldn't be obtained/created
				console.error("Could not find or create Stripe customer for subscription.");
				return res.status(500).send({ error: 'Could not process subscription customer info.' });
			}

			// 3. Set params for saving payment method
			paymentIntentParams.customer = stripeCustomerId;
			paymentIntentParams.setup_future_usage = 'on_session';
		}

		// Create the Payment Intent
		const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

		res.send({
			clientSecret: paymentIntent.client_secret,
		});

	} catch (error: any) {
		console.error("Error processing payment intent with subscriptions:", error);
		if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
			return res.status(400).send({ error: `Invalid Price ID found in request.` });
		}
		// Add more specific error handling if needed
		res.status(500).send({ error: 'Internal server error processing payment.' });
	}
});

// --- POST /api/stripe/webhook --- 
router.post('/webhook', stripeWebhookMiddleware, async (req: Request, res: Response) => {
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
		event = stripe.webhooks.constructEvent(req.body, sig as string | string[], webhookSecret);
	} catch (err: any) {
		console.error(`Webhook signature verification failed: ${err.message}`);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	console.log(`Received Stripe webhook event: ${event.type}`);

	switch (event.type) {
		case 'payment_intent.succeeded':
			const paymentIntent = event.data.object as Stripe.PaymentIntent;
			console.log(`Processing successful payment intent: ${paymentIntent.id}`);

			try {
				// --- Extract data from Payment Intent ---
				const containsSubscription = paymentIntent.metadata?.contains_subscription === 'true';
				const cartItemsString = paymentIntent.metadata?.cart_items;
				const userIdString = paymentIntent.metadata?.userId;
				const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null;
				const paymentMethodId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : null;
				const contactEmail = paymentIntent.metadata?.contactEmail;
				const contactPhone = paymentIntent.metadata?.contactPhone;
				const shippingName = paymentIntent.metadata?.shippingName;
				const shippingAddress1 = paymentIntent.metadata?.shippingAddress1;
				const shippingAddress2 = paymentIntent.metadata?.shippingAddress2;
				const shippingCity = paymentIntent.metadata?.shippingCity;
				const shippingState = paymentIntent.metadata?.shippingState;
				const shippingPostalCode = paymentIntent.metadata?.shippingPostalCode;
				const shippingCountry = paymentIntent.metadata?.shippingCountry;

				// --- Validate necessary data ---
				if (!cartItemsString || !contactEmail || !shippingName || !shippingAddress1 || !shippingCity || !shippingState || !shippingPostalCode || !shippingCountry) {
					console.error("Webhook Error: Missing essential metadata (cart_items, contact, or shipping) in PI:", paymentIntent.id);
					break; // Stop processing if core data is missing
				}

				let cartItems: CartItem[] = [];
				try {
					cartItems = JSON.parse(cartItemsString);
				} catch (parseError) {
					console.error("Webhook Error: Failed to parse cart_items metadata:", parseError, "PI:", paymentIntent.id);
					break;
				}

				const userId = userIdString ? parseInt(userIdString, 10) : null;
				const totalAmountDecimal = new Decimal(paymentIntent.amount / 100); // Convert cents to Decimal

				// --- Create Order and OrderItems in a Transaction ---
				let createdOrderId: number | null = null;
				let createdSubscriptionIds: string[] = [];

				try {
					await prisma.$transaction(async (tx) => {
						// 1. Create the Order
						const newOrder = await tx.order.create({
							data: {
								userId: userId, // Link to user if ID exists
								totalAmount: totalAmountDecimal,
								status: 'PAID', // Set status as PAID since PI succeeded
								contactEmail: contactEmail,
								contactPhone: contactPhone === 'null' ? null : contactPhone, // Handle null string from metadata
								shippingName: shippingName,
								shippingAddress1: shippingAddress1,
								shippingAddress2: shippingAddress2 === 'null' ? null : shippingAddress2,
								shippingCity: shippingCity,
								shippingState: shippingState,
								shippingPostalCode: shippingPostalCode,
								shippingCountry: shippingCountry,
								// subscriptionId: null, // Link later if needed for initial order
								items: {
									// 2. Create OrderItems inline
									create: cartItems.map((item) => ({
										productId: item.productId,
										productName: item.name,
										quantity: item.quantity,
										// Convert price string (assumed dollars) back to Decimal
										price: new Decimal(item.price),
									})),
								},
							},
							select: { id: true } // Select only the ID
						});
						createdOrderId = newOrder.id;
						console.log(`Created local Order ${createdOrderId} for PI: ${paymentIntent.id}`);

						// 3. Handle Subscription Creation (if applicable)
						if (containsSubscription) {
							console.log("PaymentIntent contains subscription, attempting to create...");
							if (!customerId || !paymentMethodId || !userId) {
								// This should ideally not happen if create-payment-intent worked
								throw new Error("Missing data for subscription creation (Customer/PM/User)");
							}

							const subscriptionItems = cartItems.filter(item => item.isSubscription);
							for (const subItem of subscriptionItems) {
								// Create Stripe Subscription
								const stripeSubscription = await stripe.subscriptions.create({
									customer: customerId,
									items: [{ price: subItem.priceId, quantity: subItem.quantity }],
									default_payment_method: paymentMethodId,
									payment_behavior: 'default_incomplete',
									expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
									metadata: { internal_user_id: userIdString, originating_payment_intent_id: paymentIntent.id }
								});
								console.log(`Stripe Subscription ${stripeSubscription.id} created with Status: ${stripeSubscription.status}`);

								// Type assertion might be needed depending on SDK version
								const subEndDate = (stripeSubscription as any).current_period_end;

								// Create Local Subscription Record
								if ((stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') && subEndDate) {
									const localSub = await tx.subscription.create({
										data: {
											userId: userId,
											stripeSubscriptionId: stripeSubscription.id,
											stripePriceId: subItem.priceId,
											status: stripeSubscription.status,
											interval: subItem.recurringInterval ?? 'unknown',
											currentPeriodEnd: new Date(subEndDate * 1000),
											cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
											// Optionally link the initial order back
											// renewalOrders: { connect: { id: createdOrderId } } // Can't connect here directly
										}
									});
									createdSubscriptionIds.push(localSub.id); // Store local DB ID
									console.log(`Local subscription record created: ${localSub.id}`);
								} else {
									console.warn(`Stripe subscription ${stripeSubscription.id} has status ${stripeSubscription.status}. Local record not created.`);
								}
							} // End loop over subscription items

							// Optionally: Link the initial order to the first created subscription
							// if (createdOrderId && createdSubscriptionIds.length > 0) {
							//   await tx.order.update({
							//     where: { id: createdOrderId },
							//     data: { subscriptionId: createdSubscriptionIds[0] }
							//   });
							//   console.log(`Linked initial Order ${createdOrderId} to Subscription ${createdSubscriptionIds[0]}`);
							// }

						} // End containsSubscription block
					}); // End Transaction

				} catch (txError: any) {
					console.error("Webhook Error: Transaction failed during order/subscription creation:", txError);
					// Decide how to handle partial failures, maybe update order status to 'error'
					return res.status(500).send('Webhook Error: Failed to save order/subscription data.');
				}

			} catch (error) {
				console.error("Error processing payment_intent.succeeded webhook logic:", error);
				return res.status(500).send('Internal server error handling webhook.');
			}
			break;
		// --- End payment_intent.succeeded Case --- 

		case 'payment_intent.payment_failed':
			const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
			console.log(`Payment failed for PaymentIntent: ${failedPaymentIntent.id}`);
			// TODO: Update order status to FAILED or notify user.
			break;

		// --- Handle other subscription-related events --- 
		case 'customer.subscription.deleted':
		case 'customer.subscription.updated':
			const subscriptionEventData = event.data.object as Stripe.Subscription;
			console.log(`Subscription ${event.type}: ${subscriptionEventData.id}, Status: ${subscriptionEventData.status}`);
			try {
				// Attempting access with 'any' cast due to persistent type issues
				const periodEndTimestamp = (subscriptionEventData as any).current_period_end;
				const updateData: {
					status: Stripe.Subscription.Status;
					cancelAtPeriodEnd: boolean;
					currentPeriodEnd?: Date;
				} = {
					status: subscriptionEventData.status,
					cancelAtPeriodEnd: subscriptionEventData.cancel_at_period_end,
					// Only add currentPeriodEnd if it's a valid number
					currentPeriodEnd: typeof periodEndTimestamp === 'number'
						? new Date(periodEndTimestamp * 1000)
						: undefined,
				};

				if (updateData.currentPeriodEnd === undefined) {
					delete updateData.currentPeriodEnd;
				}

				await prisma.subscription.updateMany({
					where: { stripeSubscriptionId: subscriptionEventData.id },
					data: updateData,
				});
				console.log(`Updated local subscription status for ${subscriptionEventData.id}`);

			} catch (dbError) {
				console.error(`Failed to update local subscription status for ${subscriptionEventData.id}:`, dbError);
			}
			break;

		// --- Handle Invoice Paid (Subscription Renewals) ---
		case 'invoice.paid':
			const invoice = event.data.object as Stripe.Invoice;
			// Use 'any' cast for subscription ID access, with type check
			const stripeSubscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : null;

			console.log(`Processing invoice.paid event for Invoice: ${invoice.id}, Subscription: ${stripeSubscriptionId}`);

			if (!stripeSubscriptionId) {
				console.log(`Invoice ${invoice.id} is not related to a subscription. Skipping.`);
				break;
			}

			if (invoice.status === 'paid') {
				try {
					const localSubscription = await prisma.subscription.findUnique({
						where: { stripeSubscriptionId: stripeSubscriptionId },
						include: { user: true }
					});

					if (!localSubscription) {
						console.error(`Webhook Error: Local subscription not found for Stripe ID: ${stripeSubscriptionId}`);
						break;
					}

					// Fetch latest subscription data from Stripe
					const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

					// Use 'any' cast for current_period_end access, with type check
					const periodEndTimestamp = (stripeSubscription as any).current_period_end;
					if (typeof periodEndTimestamp !== 'number') {
						console.error(`Webhook Error: Stripe subscription ${stripeSubscriptionId} missing numeric current_period_end.`);
						break;
					}

					await prisma.$transaction(async (tx) => {
						// 1. Update local subscription
						const updatedSub = await tx.subscription.update({
							where: { id: localSubscription.id },
							data: {
								status: stripeSubscription.status,
								currentPeriodEnd: new Date(periodEndTimestamp * 1000),
								cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
							}
						});
						console.log(`Updated local subscription ${localSubscription.id}, new end date: ${updatedSub.currentPeriodEnd}`);

						// 2. Create Renewal Order
						const lineItem = invoice.lines.data[0];
						// Use 'any' cast for price access, with checks
						const lineItemPrice = (lineItem as any)?.price;
						if (!lineItem || !lineItemPrice || typeof lineItemPrice.unit_amount !== 'number') {
							console.warn(`Invoice ${invoice.id} missing valid line item price data. Skipping renewal order.`);
							return;
						}

						const productName = lineItem.description || 'Subscription Renewal';
						const productId = typeof lineItemPrice.product === 'string' ? lineItemPrice.product : 'unknown-product';
						const quantity = lineItem.quantity || 1;
						const priceDecimal = new Decimal(lineItemPrice.unit_amount / 100);
						const totalAmountDecimal = new Decimal(invoice.amount_paid / 100);
						const contactEmail = invoice.customer_email || localSubscription.user?.email || 'unknown@example.com';
						const shippingName = invoice.customer_name || localSubscription.user?.name || 'N/A';

						await tx.order.create({
							data: {
								userId: localSubscription.userId,
								totalAmount: totalAmountDecimal,
								status: 'PAID',
								contactEmail: contactEmail,
								shippingName: shippingName,
								shippingAddress1: invoice.customer_shipping?.address?.line1 || 'N/A',
								shippingCity: invoice.customer_shipping?.address?.city || 'N/A',
								shippingState: invoice.customer_shipping?.address?.state || 'N/A',
								shippingPostalCode: invoice.customer_shipping?.address?.postal_code || 'N/A',
								shippingCountry: invoice.customer_shipping?.address?.country || 'N/A',
								subscriptionId: localSubscription.id,
								items: {
									create: [{
										productId: productId,
										productName: productName,
										quantity: quantity,
										price: priceDecimal,
									}]
								}
							},
							select: { id: true }
						});
						console.log(`Created renewal Order for Subscription ${localSubscription.id}, Invoice ${invoice.id}`);

					}); // End Transaction

				} catch (error: any) {
					console.error(`Webhook Error: Failed processing invoice.paid for subscription ${stripeSubscriptionId}:`, error);
				}
			} else {
				console.log(`Invoice ${invoice.id} status is ${invoice.status} (not 'paid'). Skipping.`);
			}
			break;
		// --- End invoice.paid Case ---

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