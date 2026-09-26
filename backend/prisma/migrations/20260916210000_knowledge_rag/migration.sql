CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeKind" AS ENUM ('OFFICIAL_FACT', 'PERSONAL_EXPERIENCE');
CREATE TYPE "KnowledgeVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "KnowledgeStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "KnowledgeDocument" (
    "id" UUID NOT NULL,
    "kind" "KnowledgeKind" NOT NULL,
    "visibility" "KnowledgeVisibility" NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "placeSourceId" UUID,
    "tripResourceId" UUID,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "sourceFetchedAt" TIMESTAMP(3),
    "sourceExpiresAt" TIMESTAMP(3),
    "contentHash" VARCHAR(64) NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeDocument_visibility_owner_check" CHECK (
      ("visibility" = 'PUBLIC' AND "userId" IS NULL AND "guestId" IS NULL) OR
      ("visibility" = 'PRIVATE' AND (("userId" IS NOT NULL)::int + ("guestId" IS NOT NULL)::int = 1))
    ),
    CONSTRAINT "KnowledgeDocument_kind_visibility_check" CHECK (
      ("kind" = 'OFFICIAL_FACT' AND "visibility" = 'PUBLIC') OR
      ("kind" = 'PERSONAL_EXPERIENCE' AND "visibility" = 'PRIVATE')
    )
);

CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeEmbedding" (
    "id" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(1024),
    "status" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeEmbedding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeEmbedding_dimensions_check" CHECK ("dimensions" = 1024)
);

CREATE UNIQUE INDEX "KnowledgeDocument_placeSourceId_key" ON "KnowledgeDocument"("placeSourceId");
CREATE UNIQUE INDEX "KnowledgeDocument_tripResourceId_key" ON "KnowledgeDocument"("tripResourceId");
CREATE UNIQUE INDEX "KnowledgeDocument_provider_externalId_key" ON "KnowledgeDocument"("provider", "externalId");
CREATE UNIQUE INDEX "KnowledgeDocument_userId_contentHash_key" ON "KnowledgeDocument"("userId", "contentHash");
CREATE UNIQUE INDEX "KnowledgeDocument_guestId_contentHash_key" ON "KnowledgeDocument"("guestId", "contentHash");
CREATE INDEX "KnowledgeDocument_visibility_kind_status_idx" ON "KnowledgeDocument"("visibility", "kind", "status");
CREATE INDEX "KnowledgeDocument_userId_status_idx" ON "KnowledgeDocument"("userId", "status");
CREATE INDEX "KnowledgeDocument_guestId_status_idx" ON "KnowledgeDocument"("guestId", "status");
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_sequence_key" ON "KnowledgeChunk"("documentId", "sequence");
CREATE INDEX "KnowledgeChunk_documentId_contentHash_idx" ON "KnowledgeChunk"("documentId", "contentHash");
CREATE UNIQUE INDEX "KnowledgeEmbedding_chunkId_model_modelVersion_key" ON "KnowledgeEmbedding"("chunkId", "model", "modelVersion");
CREATE INDEX "KnowledgeEmbedding_model_modelVersion_status_idx" ON "KnowledgeEmbedding"("model", "modelVersion", "status");
CREATE INDEX "KnowledgeEmbedding_embedding_hnsw_idx" ON "KnowledgeEmbedding" USING hnsw ("embedding" vector_cosine_ops) WHERE "status" = 'READY';

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_placeSourceId_fkey" FOREIGN KEY ("placeSourceId") REFERENCES "PlaceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_tripResourceId_fkey" FOREIGN KEY ("tripResourceId") REFERENCES "TripResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
