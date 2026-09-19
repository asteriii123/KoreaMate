import type { ConversationDecision } from "@koreamate/contracts";

export const CONVERSATION_INTENT_PROVIDER = Symbol("CONVERSATION_INTENT_PROVIDER");

export type ConversationContext = {
  message: string;
  recentMessages: Array<{ role: string; text: string }>;
  requirements: unknown | null;
  pendingField: string | null;
  previousPlan: unknown | null;
};

export interface ConversationIntentProvider {
  decide(context: ConversationContext): Promise<ConversationDecision>;
}
