import { Module } from "@nestjs/common";
import { ConversationsModule } from "./modules/conversations/conversations.module.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { TranslationModule } from "./modules/translation/translation.module.js";
import { TravelModule } from "./modules/travel/travel.module.js";
import { PlacesModule } from "./modules/places/places.module.js";

@Module({ imports: [DatabaseModule, HealthModule, TranslationModule, TravelModule, PlacesModule, ConversationsModule, JobsModule] })
export class AppModule {}
