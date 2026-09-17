import { Module } from "@nestjs/common";
import { TranslationModule } from "../translate/translate.module.js";
import { TravelModule } from "../plan/plan.module.js";
import { ConversationsController } from "./chat.controller.js";
import { ConversationsService } from "./chat.service.js";
import { ImageAssetsModule } from "../image/image.module.js";

@Module({
  imports: [TranslationModule, TravelModule, ImageAssetsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
