CREATE TYPE "ImageAssetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'TEXT_ONLY', 'FAILED');

CREATE TABLE "ImageAsset" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "originalKey" TEXT NOT NULL,
  "translatedKey" TEXT,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "status" "ImageAssetStatus" NOT NULL DEFAULT 'UPLOADED',
  "regions" JSONB,
  "errorCode" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImageAsset_originalKey_key" ON "ImageAsset"("originalKey");
CREATE UNIQUE INDEX "ImageAsset_translatedKey_key" ON "ImageAsset"("translatedKey");
CREATE INDEX "ImageAsset_messageId_createdAt_idx" ON "ImageAsset"("messageId", "createdAt");
CREATE INDEX "ImageAsset_expiresAt_status_idx" ON "ImageAsset"("expiresAt", "status");
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
