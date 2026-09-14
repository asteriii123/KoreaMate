-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRequirement" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripVersion" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" UUID NOT NULL,
    "tripVersionId" UUID NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATE,
    "title" TEXT NOT NULL,
    "estimatedCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" UUID NOT NULL,
    "itineraryDayId" UUID NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedCost" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_conversationId_key" ON "Trip"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "TripRequirement_tripId_key" ON "TripRequirement"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripVersion_tripId_versionNumber_key" ON "TripVersion"("tripId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryDay_tripVersionId_dayNumber_key" ON "ItineraryDay"("tripVersionId", "dayNumber");

-- CreateIndex
CREATE INDEX "ItineraryItem_itineraryDayId_startTime_idx" ON "ItineraryItem"("itineraryDayId", "startTime");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRequirement" ADD CONSTRAINT "TripRequirement_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVersion" ADD CONSTRAINT "TripVersion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_tripVersionId_fkey" FOREIGN KEY ("tripVersionId") REFERENCES "TripVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_itineraryDayId_fkey" FOREIGN KEY ("itineraryDayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
