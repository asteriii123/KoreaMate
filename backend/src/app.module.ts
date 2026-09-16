import { Module } from "@nestjs/common";
import { ConversationsModule } from "./modules/conversations/conversations.module.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { TranslationModule } from "./modules/translation/translation.module.js";
import { TravelModule } from "./modules/travel/travel.module.js";
import { PlacesModule } from "./modules/places/places.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { SpeechModule } from "./modules/speech/speech.module.js";
import { SavedPlacesModule } from "./modules/saved-places/saved-places.module.js";
import { MemoryModule } from "./modules/memory/memory.module.js";

@Module({ imports: [DatabaseModule, AuthModule, HealthModule, TranslationModule, TravelModule, PlacesModule, ConversationsModule, JobsModule, SpeechModule, SavedPlacesModule, MemoryModule] })
export class AppModule {}
