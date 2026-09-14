-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "idempotencyKey" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Translation" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "sourceMessageId" UUID NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "naturalExpression" TEXT NOT NULL,
    "pronunciation" TEXT,
    "politeness" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Translation_sourceMessageId_key" ON "Translation"("sourceMessageId");

-- CreateIndex
CREATE INDEX "Translation_conversationId_createdAt_idx" ON "Translation"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
