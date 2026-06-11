-- AlterTable
ALTER TABLE "User" ADD COLUMN     "favorite_pokemon_id" TEXT,
ADD COLUMN     "trainer_gender" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_favorite_pokemon_id_fkey" FOREIGN KEY ("favorite_pokemon_id") REFERENCES "UserPokemon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
