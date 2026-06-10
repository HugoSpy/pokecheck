-- DropForeignKey
ALTER TABLE "TradeItem" DROP CONSTRAINT "TradeItem_pokemon_id_fkey";

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_pokemon_id_fkey" FOREIGN KEY ("pokemon_id") REFERENCES "UserPokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
