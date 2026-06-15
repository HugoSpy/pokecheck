-- AlterTable
ALTER TABLE "UserPokemon" ADD COLUMN     "original_owner_id" TEXT,
ADD COLUMN     "trade_count" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "UserPokemon" ADD CONSTRAINT "UserPokemon_original_owner_id_fkey" FOREIGN KEY ("original_owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Snapshot: set original_owner = current holder for all existing rows
UPDATE "UserPokemon" SET original_owner_id = user_id WHERE original_owner_id IS NULL;

-- Backfill trade_count from accepted trades history
UPDATE "UserPokemon" up
SET trade_count = (
  SELECT COUNT(*) FROM "Trade" t
  WHERE t.to_pokemon_id = up.id AND t.status = 'accepted'
);
