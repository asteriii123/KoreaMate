CREATE TYPE "MemoryKind" AS ENUM ('departure_city', 'budget_level', 'pace', 'interest', 'constraint');

CREATE TABLE "UserMemory" (
    "id" UUID NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "normalizedValue" VARCHAR(120) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "sourceMessageId" UUID,
    "userId" UUID,
    "guestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastConfirmedAt" TIMESTAMP(3),
    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserMemory_identity_check" CHECK (("userId" IS NOT NULL) <> ("guestId" IS NOT NULL)),
    CONSTRAINT "UserMemory_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

CREATE UNIQUE INDEX "UserMemory_userId_kind_normalizedValue_key" ON "UserMemory"("userId", "kind", "normalizedValue");
CREATE UNIQUE INDEX "UserMemory_guestId_kind_normalizedValue_key" ON "UserMemory"("guestId", "kind", "normalizedValue");
CREATE INDEX "UserMemory_userId_kind_updatedAt_idx" ON "UserMemory"("userId", "kind", "updatedAt");
CREATE INDEX "UserMemory_guestId_kind_updatedAt_idx" ON "UserMemory"("guestId", "kind", "updatedAt");
CREATE INDEX "UserMemory_sourceMessageId_idx" ON "UserMemory"("sourceMessageId");

ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
