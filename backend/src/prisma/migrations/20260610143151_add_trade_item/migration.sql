-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "pokemon_id" TEXT NOT NULL,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeItem_trade_id_idx" ON "TradeItem"("trade_id");

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_pokemon_id_fkey" FOREIGN KEY ("pokemon_id") REFERENCES "UserPokemon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
