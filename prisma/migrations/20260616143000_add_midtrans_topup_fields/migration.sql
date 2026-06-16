-- Add Midtrans provider tracking to QRIS top-up requests.
ALTER TABLE "TopupRequest"
ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "providerOrderId" TEXT,
ADD COLUMN "providerTransactionId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerFraudStatus" TEXT,
ADD COLUMN "qrCodeUrl" TEXT,
ADD COLUMN "qrString" TEXT,
ADD COLUMN "providerPayload" TEXT;

CREATE UNIQUE INDEX "TopupRequest_providerOrderId_key" ON "TopupRequest"("providerOrderId");
CREATE INDEX "TopupRequest_paymentProvider_providerStatus_idx" ON "TopupRequest"("paymentProvider", "providerStatus");
