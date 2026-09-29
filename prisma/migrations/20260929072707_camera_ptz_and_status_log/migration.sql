-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "firmware" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ptzSupported" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CameraStatusLog" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CameraStatusLog_cameraId_createdAt_idx" ON "CameraStatusLog"("cameraId", "createdAt");

-- AddForeignKey
ALTER TABLE "CameraStatusLog" ADD CONSTRAINT "CameraStatusLog_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
