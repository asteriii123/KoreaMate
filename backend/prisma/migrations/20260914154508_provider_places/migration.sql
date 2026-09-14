-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN     "placeId" UUID;

-- CreateTable
CREATE TABLE "Place" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceSource" (
    "id" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripResource" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCall" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Place_normalizedName_idx" ON "Place"("normalizedName");

-- CreateIndex
CREATE INDEX "PlaceSource_placeId_fetchedAt_idx" ON "PlaceSource"("placeId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSource_provider_externalId_key" ON "PlaceSource"("provider", "externalId");

-- CreateIndex
CREATE INDEX "TripResource_tripId_kind_idx" ON "TripResource"("tripId", "kind");

-- CreateIndex
CREATE INDEX "ProviderCall_provider_createdAt_idx" ON "ProviderCall"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceSource" ADD CONSTRAINT "PlaceSource_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripResource" ADD CONSTRAINT "TripResource_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
