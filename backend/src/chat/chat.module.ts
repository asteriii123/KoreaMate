import { Module } from "@nestjs/common";
import { TranslationModule } from "../translate/translate.module.js";
import { TravelModule } from "../plan/plan.module.js";
import { ConversationsController } from "./chat.controller.js";
import { ConversationsService } from "./chat.service.js";
import { ImageAssetsModule } from "../image/image.module.js";
import { ConversationService } from "../agent/conversation.service.js";
import { CONVERSATION_INTENT_PROVIDER } from "../agent/intent-provider.js";
import { LlmIntentRouter } from "../agent/intent-router.js";
import { AgentModule } from "../agent/agent.module.js";

@Module({
  imports: [TranslationModule, TravelModule, ImageAssetsModule, AgentModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationService, LlmIntentRouter, { provide: CONVERSATION_INTENT_PROVIDER, useExisting: LlmIntentRouter }],
})
export class ConversationsModule {}
