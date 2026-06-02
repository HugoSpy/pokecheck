-- CreateTable
CREATE TABLE "AttendanceCheck" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,

    CONSTRAINT "AttendanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceOpening" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_pokemon_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolled_back" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttendanceOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceOpening_attendance_id_user_id_key" ON "AttendanceOpening"("attendance_id", "user_id");

-- AddForeignKey
ALTER TABLE "AttendanceOpening" ADD CONSTRAINT "AttendanceOpening_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "AttendanceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
