-- CreateTable
CREATE TABLE "BattleRecord" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "winner_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleRecord_pkey" PRIMARY KEY ("id")
);

