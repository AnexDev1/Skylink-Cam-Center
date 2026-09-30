-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MOTION', 'OFFLINE', 'ONLINE', 'TAMPER');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_cameraId_createdAt_idx" ON "Event"("cameraId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_acknowledged_createdAt_idx" ON "Event"("acknowledged", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
