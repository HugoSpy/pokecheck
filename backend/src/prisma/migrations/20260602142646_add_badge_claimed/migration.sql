-- AlterTable
ALTER TABLE "UserBadge" ADD COLUMN     "claimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claimed_at" TIMESTAMP(3);

-- Backfill: existing badges had coins auto-credited, mark them as claimed
UPDATE "UserBadge" SET "claimed" = true, "claimed_at" = "unlocked_at";
