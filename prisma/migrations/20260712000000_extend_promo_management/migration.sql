-- CreateEnum
CREATE TYPE "PromoCodeType" AS ENUM ('registration', 'topup', 'any');

-- DropIndex
DROP INDEX "PromoRedemption_userId_key";

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "bonusPercent" INTEGER,
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "type" "PromoCodeType" NOT NULL DEFAULT 'registration',
ALTER COLUMN "creditAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "PromoRedemption" ADD COLUMN     "context" TEXT NOT NULL DEFAULT 'registration';

-- AlterTable
ALTER TABLE "TopupRequest" ADD COLUMN     "promoCodeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_userId_codeId_key" ON "PromoRedemption"("userId", "codeId");

-- AddForeignKey
ALTER TABLE "TopupRequest" ADD CONSTRAINT "TopupRequest_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
