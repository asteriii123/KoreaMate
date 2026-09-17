import { Module } from "@nestjs/common";
import { ConversationsModule } from "./chat/chat.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { TranslationModule } from "./translate/translate.module.js";
import { TravelModule } from "./plan/plan.module.js";
import { PlacesModule } from "./place/place.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { SpeechModule } from "./speech/speech.module.js";
import { SavedPlacesModule } from "./saved/saved.module.js";
import { MemoryModule } from "./memory/memory.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { ImageAssetsModule } from "./image/image.module.js";

@Module({ imports: [DatabaseModule, AuthModule, ImageAssetsModule, KnowledgeModule, HealthModule, TranslationModule, TravelModule, PlacesModule, ConversationsModule, JobsModule, SpeechModule, SavedPlacesModule, MemoryModule] })
export class AppModule {}
