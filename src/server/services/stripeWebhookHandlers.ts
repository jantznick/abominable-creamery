import Stripe from 'stripe';
import prisma from '../db';
import { Decimal } from '@prisma/client/runtime/library';
import { getCheckoutAttempt, deleteCheckoutAttempt } from '../utils/checkoutTmpStore';
import { OrderStatus } from '@prisma/client'; // Import OrderStatus enum

// Ensure stripe is initialized and passed or imported
// For now, assuming stripe is passed as an argument
// Similar for logger if you have one

export async function handleSetupIntentSucceeded(
    event: Stripe.Event,
    stripe: Stripe // Pass the initialized Stripe client
) {
    // ... existing handleSetupIntentSucceeded code ...
}

// Add other handlers here...
export async function handlePaymentIntentSucceeded(
    event: Stripe.Event,
    stripe: Stripe
) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log(`---> Handling ${event.type} for PaymentIntent ID: ${paymentIntent.id}`);

    // --- Logic Using Temporary Store ---
    try {
        // --- 1. Extract checkoutAttemptId ---
        const checkoutAttemptId = paymentIntent.metadata?.checkoutAttemptId;
        if (!checkoutAttemptId) {
            console.warn(`Webhook (PI Succeeded ${paymentIntent.id}): Missing checkoutAttemptId metadata. Cannot create order.`);
            // If this PI wasn't created through our checkout flow, we can't link it easily.
            return;
        }

        // --- 2. Retrieve Context ---
        console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Retrieving context using ID: ${checkoutAttemptId}`);
        const context = await getCheckoutAttempt(checkoutAttemptId);
        if (!context) {
            console.error(`Webhook (PI Succeeded ${paymentIntent.id}): Failed to retrieve checkout context for ID: ${checkoutAttemptId}.`);
            return;
        }
        console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Successfully retrieved context.`);

        // Type context properly if possible, using any for now
        const { userId, cartItems, contactInfo, shippingAddress } = context as any;

        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !contactInfo || !shippingAddress) {
            console.error(`Webhook (PI Succeeded ${paymentIntent.id}): Invalid context structure retrieved for ID: ${checkoutAttemptId}.`);
            return;
        }

        // --- 3. Check if One-Time Purchase (Crucial) ---
        const containsSubscription = cartItems.some((item: any) => item.isSubscription);
        if (containsSubscription) {
            console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Context ID ${checkoutAttemptId} indicates subscription involved. Order creation handled by setup_intent.succeeded. Skipping PI handler.`);
            // IMPORTANT: If subscription items were present, the SI handler should have created the order.
            // We should delete the temp context here ONLY if we are sure the SI handler succeeded.
            // For simplicity now, let the SI handler manage deletion.
            return;
        }

        // --- 4. Create Order for One-Time Purchase ---
        console.log(`Webhook (PI Succeeded ${paymentIntent.id}): Processing as one-time purchase order using context ID ${checkoutAttemptId}.`);

        // Calculate subtotal and shipping cost first
        let orderSubtotal = 0;
        cartItems.forEach((item: any) => {
            const price = parseFloat(item.price);
            if (!isNaN(price)) {
                orderSubtotal += price * item.quantity;
            }
        });

        let shippingCost = 0;
        let shippingPriceDecimal = new Decimal(0);
        const shippingPriceIdEnv = process.env.STRIPE_SHIPPING_RATE_PRICE_ID;
        if (orderSubtotal > 0 && shippingPriceIdEnv) {
            try {
                const shippingStripePrice = await stripe.prices.retrieve(shippingPriceIdEnv);
                if (shippingStripePrice && shippingStripePrice.active && shippingStripePrice.unit_amount) {
                    shippingCost = (shippingStripePrice.unit_amount / 100); // Cost in dollars
                    shippingPriceDecimal = new Decimal(shippingCost.toFixed(2));
                } else {
                    console.warn(`Webhook Warning: Shipping Price ID ${shippingPriceIdEnv} invalid/inactive. Shipping cost not added to order total/items.`);
                }
            } catch (priceError: any) {
                console.error(`Webhook Error fetching shipping price ${shippingPriceIdEnv}: ${priceError.message}. Shipping cost not added.`);
            }
        } else if (orderSubtotal > 0) {
            console.warn("Webhook Warning: STRIPE_SHIPPING_RATE_PRICE_ID not set. Shipping cost not added to order total/items.");
        }

        const finalTotalAmount = orderSubtotal + shippingCost;
        const totalAmountDecimal = new Decimal(finalTotalAmount.toFixed(2));

        // Optional: Check if order already exists with this checkoutAttemptId to prevent duplicates
        const existingOrder = await prisma.order.findUnique({ where: { checkoutAttemptId } });
        if (existingOrder) {
            console.warn(`Webhook (PI Succeeded ${paymentIntent.id}): Order with checkoutAttemptId ${checkoutAttemptId} already exists (ID: ${existingOrder.id}). Skipping creation.`);
            // Delete the temporary context data even if duplicate order found
            await deleteCheckoutAttempt(checkoutAttemptId);
            return;
        }

        // Map cart items and add shipping item conditionally
        const orderItemsInput = cartItems.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || 'Unknown',
            quantity: item.quantity,
            price: new Decimal(item.price || 0),
        }));
        if (shippingCost > 0 && shippingPriceIdEnv) {
            orderItemsInput.push({
                productId: shippingPriceIdEnv, // Use the actual Price ID
                productName: 'Shipping', // Keep generic name
                quantity: 1,
                price: shippingPriceDecimal // Use fetched price
            });
        }

        const newOrder = await prisma.order.create({ // Use transaction later if needed
            data: {
                userId: userId, // Use userId from context
                totalAmount: totalAmountDecimal,
                status: 'PAID', // Use OrderStatus enum value 'PAID'
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
                    create: orderItemsInput, // Use the combined array
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
}

export async function handlePaymentIntentPaymentFailed(
    event: Stripe.Event,
    stripe: Stripe
) {
    const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log(`Payment failed for PaymentIntent: ${failedPaymentIntent.id}`);
    // TODO: Update order status to FAILED or notify user based on checkoutAttemptId if possible.
    // If an order was created prematurely (shouldn't happen with current flow), update its status.
    const checkoutAttemptId = failedPaymentIntent.metadata?.checkoutAttemptId;
    if (checkoutAttemptId) {
        console.log(`    Failed PI was associated with checkoutAttemptId: ${checkoutAttemptId}`);
        // Optionally try to find an order with this ID and mark it as failed,
        // but usually, the order isn't created until success.
    }
}

export async function handleCustomerSubscriptionCreated(
    event: Stripe.Event,
    stripe: Stripe
) {
    const createdSub = event.data.object as Stripe.Subscription;
    console.log(`---> Handling ${event.type} for Sub ID: ${createdSub.id}, Status: ${createdSub.status}`);
    // No primary action needed here in the new flow, as activation/creation is handled
    // by setup_intent.succeeded. Logged for visibility.
}

export async function handleCustomerSubscriptionDeleted(
    event: Stripe.Event,
    stripe: Stripe
) {
    const deletedSub = event.data.object as Stripe.Subscription;
    console.log(`---> Handling ${event.type} for Sub ID: ${deletedSub.id}`);
    // Find local sub by stripeSubscriptionId and update status to 'canceled'
    try {
        const updateResult = await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: deletedSub.id },
            data: { status: 'canceled', cancelAtPeriodEnd: true } // Mark as canceled immediately
        });
        if (updateResult.count > 0) {
            console.log(`    Marked local subscription(s) as canceled: ${deletedSub.id}`);
        } else {
             console.log(`    Local subscription ${deletedSub.id} not found or already marked canceled.`);
        }
    } catch (dbError) {
        console.error(`    Failed to mark local subscription as canceled: ${deletedSub.id}`, dbError);
    }
}

export async function handleCustomerSubscriptionUpdated(
    event: Stripe.Event,
    stripe: Stripe
) {
    const updatedSub = event.data.object as Stripe.Subscription;
    console.log(`---> Handling ${event.type} for Sub ID: ${updatedSub.id}`);
    console.log(`    Incoming Status: ${updatedSub.status}`);
    console.log(`    Incoming cancelAtPeriodEnd: ${updatedSub.cancel_at_period_end}`);
    console.log(`    Incoming current_period_end (raw): ${(updatedSub as any).current_period_end}`);
    console.log(`    Incoming pause_collection: ${JSON.stringify((updatedSub as any).pause_collection)}`);

    try {
        // Attempt to find existing local subscription
        console.log(`    Searching for existing local subscription with Stripe ID: ${updatedSub.id}`);
        const existingLocalSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: updatedSub.id },
        });

        if (existingLocalSub) {
            // --- Update Existing Subscription ---
            console.log(`    Found local subscription ID: ${existingLocalSub.id}. Updating...`);
            const periodEndTimestamp = (updatedSub as any).current_period_end;
            const updateData: any = {
                status: updatedSub.status,
                cancelAtPeriodEnd: updatedSub.cancel_at_period_end,
                collectionPaused: (updatedSub as any).pause_collection?.behavior === 'void',
                currentPeriodEnd: typeof periodEndTimestamp === 'number'
                    ? new Date(periodEndTimestamp * 1000)
                    : existingLocalSub.currentPeriodEnd, // Keep existing if null/undefined comes in
            };
            // Clean potential undefined value if Stripe sends null for period end
            if (updateData.currentPeriodEnd === undefined || updateData.currentPeriodEnd === null) {
                delete updateData.currentPeriodEnd;
            }

            console.log(`    Attempting DB update for ${existingLocalSub.id} with data:`, JSON.stringify(updateData));
            const updateResult = await prisma.subscription.update({
                where: { id: existingLocalSub.id },
                data: updateData,
            });
            console.log(`    DB update successful for ${existingLocalSub.id}. New status: ${updateResult.status}`);

        } else {
            // --- Local Subscription Not Found ---
            console.warn(`    WARNING: Local subscription not found for Stripe ID ${updatedSub.id} during update. It should have been created by setup_intent.succeeded.`);
            // Potentially log this for monitoring, as it might indicate an issue in the setup_intent flow.
        }

    } catch (dbError) {
        console.error(`---> ERROR during ${event.type} DB processing for ${updatedSub.id}:`, dbError);
    }
}

export async function handleInvoicePaid(
    event: Stripe.Event,
    stripe: Stripe
) {
    const paidInvoice = event.data.object as Stripe.Invoice;
    const subIdForInvoice = typeof (paidInvoice as any).subscription === 'string' ? (paidInvoice as any).subscription : null;

    console.log(`---> Handling ${event.type} for Invoice ID: ${paidInvoice.id}`);
    console.log(`    Related Subscription ID: ${subIdForInvoice}`);
    console.log(`    Invoice Status: ${paidInvoice.status}`);
    console.log(`    Billing Reason: ${paidInvoice.billing_reason}`);

    // --- Focus on Renewals/Updates triggered by subscription cycle/update ---
    if (paidInvoice.status === 'paid' && subIdForInvoice &&
        (paidInvoice.billing_reason === 'subscription_cycle' || paidInvoice.billing_reason === 'subscription_update'))
    {
        console.log(`    Processing as subscription renewal/update payment.`);
        try {
            // --- Renewal Logic ---
            await prisma.$transaction(async (tx) => {
                // 1. Find local subscription
                const localSubscription = await tx.subscription.findUnique({
                    where: { stripeSubscriptionId: subIdForInvoice },
                    include: { user: true } // Include user for fallback email/name
                });
                if (!localSubscription) {
                    console.error(`    ERROR: Local subscription ${subIdForInvoice} not found for renewal invoice ${paidInvoice.id}. Cannot create renewal order.`);
                    // Throwing here will rollback the transaction, which is appropriate.
                    throw new Error(`Local subscription ${subIdForInvoice} not found for renewal.`);
                }
                console.log(`    Found local subscription ID: ${localSubscription.id} for renewal.`);

                // 2. Fetch latest subscription data from Stripe for accurate period end (redundant if relying on updated event, but safer)
                let stripeSubscription: Stripe.Subscription | null = null;
                try {
                    stripeSubscription = await stripe!.subscriptions.retrieve(subIdForInvoice);
                } catch (stripeError) {
                    console.error(`    ERROR: Failed to retrieve Stripe subscription ${subIdForInvoice} during renewal processing for invoice ${paidInvoice.id}:`, stripeError);
                     throw new Error(`Failed to retrieve Stripe subscription ${subIdForInvoice}.`);
                }
                console.log(`    Fetched Stripe Sub Status: ${stripeSubscription.status}, Period End: ${(stripeSubscription as any).current_period_end}`);
                const periodEndTimestamp = (stripeSubscription as any).current_period_end;

                // 3. Update local subscription (status, period end) - Ensures sync
                console.log(`    ---> Inside Renewal Transaction: Updating local subscription ${localSubscription.id}`);
                await tx.subscription.update({
                    where: { id: localSubscription.id },
                    data: {
                        status: stripeSubscription.status, // Ensure status is updated based on Stripe's view
                        currentPeriodEnd: typeof periodEndTimestamp === 'number' ? new Date(periodEndTimestamp * 1000) : localSubscription.currentPeriodEnd, // Keep existing if Stripe is null/invalid
                        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end, // Sync cancellation status
                    }
                });
                console.log(`    ---> Inside Renewal Transaction: Local subscription updated.`);

                // 4. Create Renewal Order
                console.log(`    ---> Inside Renewal Transaction: Creating renewal Order for Invoice ${paidInvoice.id}`);

                // Create OrderItem data for ALL line items on the invoice
                const orderItemsData = paidInvoice.lines.data.map(lineItem => {
                    const lineItemPrice = (lineItem as any)?.price; // Type assertion to access price
                    const quantity = lineItem.quantity ?? 1; // Default quantity to 1 if null
                    const unitAmount = (lineItem.amount / 100) / quantity; // Calculate unit price in dollars

                    return {
                        productId: typeof lineItemPrice?.product === 'string' ? lineItemPrice.product : 'unknown_product_id', // Provide a default/placeholder
                        productName: lineItem.description || lineItemPrice?.nickname || 'Subscription Item', // Use description or price nickname
                        quantity: quantity,
                        price: new Decimal(unitAmount.toFixed(2)), // Store unit price as Decimal
                    };
                }).filter(item => item.price.greaterThan(0)); // Filter out zero-amount items

                if (orderItemsData.length === 0) {
                    console.warn(`    WARNING: Invoice ${paidInvoice.id} renewal has no valid line items with amount > 0. Skipping order creation.`);
                    return; // Exit transaction block if no valid items
                }

                // Attempt to get shipping details from invoice customer details
                const shipping = paidInvoice.customer_shipping;
                const address = shipping?.address;

                await tx.order.create({
                    data: {
                        userId: localSubscription.userId,
                        subscriptionId: localSubscription.id, // Link to the subscription
                        totalAmount: new Decimal(paidInvoice.amount_paid / 100), // Use the total paid amount from Stripe
                        status: 'PAID', // Use OrderStatus enum value 'PAID'
                        // Use invoice details, falling back to user details
                        contactEmail: paidInvoice.customer_email || localSubscription.user?.email || 'unknown@example.com',
                        contactPhone: paidInvoice.customer_phone || null,
                        shippingName: shipping?.name || localSubscription.user?.name || 'N/A',
                        shippingAddress1: address?.line1 || 'N/A',
                        shippingAddress2: address?.line2 || null,
                        shippingCity: address?.city || 'N/A',
                        shippingState: address?.state || 'N/A',
                        shippingPostalCode: address?.postal_code || 'N/A',
                        shippingCountry: address?.country || 'N/A',
                        // Note: No checkoutAttemptId for renewals
                        items: {
                            create: orderItemsData // Use the mapped array of all items
                        }
                    }
                });
                console.log(`    ---> Inside Renewal Transaction: Renewal Order created successfully.`);
            }); // End Renewal Transaction
        } catch (error: any) {
            // Catch errors during the renewal transaction
            console.error(`---> ERROR processing renewal transaction for invoice ${paidInvoice.id}:`, error);
            // Consider adding monitoring/alerting here
        }
    } else {
        // Log why this invoice.paid event is being ignored
        console.log(`    Invoice ${paidInvoice.id} not processed as renewal: Status=${paidInvoice.status}, SubID=${subIdForInvoice}, Reason=${paidInvoice.billing_reason}`);
         // Handle invoice.paid related to initial subscription setup if necessary (though SI flow should handle this)
        // if (paidInvoice.billing_reason === 'subscription_create') { ... }
    }
}

export async function handleInvoicePaymentFailed(
    event: Stripe.Event,
    stripe: Stripe
) {
    const failedInvoice = event.data.object as Stripe.Invoice;
    // Use 'any' cast for subscription ID access, with type check
    const failedSubId = typeof (failedInvoice as any).subscription === 'string' ? (failedInvoice as any).subscription : null;

    console.log(`---> Handling ${event.type} for Invoice ID: ${failedInvoice.id}, Subscription: ${failedSubId}`);

    if (failedSubId) {
        try {
            // Find the relevant local subscription
            const localSubscription = await prisma.subscription.findUnique({
                where: { stripeSubscriptionId: failedSubId },
            });

            if (localSubscription) {
                // Update the status - use 'past_due' or 'unpaid'
                // Stripe might also set the subscription status directly (handled by customer.subscription.updated),
                // but explicitly setting it here on failure is good practice.
                const updatedStatus = 'past_due'; // Or 'unpaid', 'inactive' etc. based on Stripe's status flow
                await prisma.subscription.update({
                    where: { id: localSubscription.id },
                    data: { status: updatedStatus },
                });
                console.log(`    Updated local subscription ${localSubscription.id} status to ${updatedStatus} due to failed invoice ${failedInvoice.id}`);

                // TODO: Add user notification logic here (e.g., send email about payment failure)

            } else {
                console.warn(`    Webhook Warning: Received invoice.payment_failed for non-existent local subscription. Stripe Sub ID: ${failedSubId}`);
            }
        } catch (error) {
            console.error(`    Webhook Error: Failed processing invoice.payment_failed for subscription ${failedSubId}:`, error);
        }
    } else {
        console.log(`    Invoice ${failedInvoice.id} payment failed, but it was not linked to a subscription.`);
         // Could be a one-off invoice failure, log appropriately.
    }
}

// ... potential default handler or error handler for unhandled types ...
export async function handleUnhandledEvent(event: Stripe.Event) {
    console.warn(`Unhandled webhook event type received: ${event.type}`);
    // Optionally log the event data for debugging
    // console.log("Unhandled event data:", event.data.object);
} 