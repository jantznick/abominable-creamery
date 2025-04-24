-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "collectionPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
