-- Add the single entry point while preserving existing travel and translation conversations.
ALTER TYPE "ConversationMode" ADD VALUE IF NOT EXISTS 'UNIFIED';
