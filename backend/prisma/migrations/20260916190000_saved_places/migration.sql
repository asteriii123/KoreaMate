ALTER TABLE "Place" ADD COLUMN "nameZh" TEXT;

CREATE TABLE "SavedPlace" (
    "id" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "note" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SavedPlace_identity_check" CHECK (("userId" IS NOT NULL) <> ("guestId" IS NOT NULL))
);

CREATE UNIQUE INDEX "SavedPlace_userId_placeId_key" ON "SavedPlace"("userId", "placeId");
CREATE UNIQUE INDEX "SavedPlace_guestId_placeId_key" ON "SavedPlace"("guestId", "placeId");
CREATE INDEX "SavedPlace_userId_createdAt_idx" ON "SavedPlace"("userId", "createdAt");
CREATE INDEX "SavedPlace_guestId_createdAt_idx" ON "SavedPlace"("guestId", "createdAt");

ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
