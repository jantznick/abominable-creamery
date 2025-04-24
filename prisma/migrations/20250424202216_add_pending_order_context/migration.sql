-- CreateTable
CREATE TABLE "PendingOrderContext" (
    "paymentIntentId" TEXT NOT NULL,
    "userId" INTEGER,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "cartDetails" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingOrderContext_pkey" PRIMARY KEY ("paymentIntentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrderContext_paymentIntentId_key" ON "PendingOrderContext"("paymentIntentId");

-- CreateIndex
CREATE INDEX "PendingOrderContext_createdAt_idx" ON "PendingOrderContext"("createdAt");
