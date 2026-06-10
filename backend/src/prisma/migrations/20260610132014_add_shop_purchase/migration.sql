-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gen" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_user_id_gen_day_key" ON "ShopPurchase"("user_id", "gen", "day");

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
