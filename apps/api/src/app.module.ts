import { Module } from "@nestjs/common";
import { ConversationsModule } from "./modules/conversations/conversations.module.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";

@Module({ imports: [DatabaseModule, HealthModule, ConversationsModule, JobsModule] })
export class AppModule {}
