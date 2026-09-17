import { Module } from "@nestjs/common";
import { TranslationModule } from "../translation/translation.module.js";
import { TravelModule } from "../travel/travel.module.js";
import { ConversationsController } from "./conversations.controller.js";
import { ConversationsService } from "./conversations.service.js";
import { ImageAssetsModule } from "../image-assets/image-assets.module.js";

@Module({
  imports: [TranslationModule, TravelModule, ImageAssetsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
