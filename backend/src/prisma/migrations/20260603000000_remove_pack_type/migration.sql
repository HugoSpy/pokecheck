-- Rename price_standard to price, drop price_premium
ALTER TABLE "Event" RENAME COLUMN "price_standard" TO "price";
ALTER TABLE "Event" DROP COLUMN "price_premium";
