import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ImageAssetsController } from "./image.controller.js";
import { ImageAssetsService } from "./image.service.js";
import { ImageStorageService } from "./storage.js";

@Module({ imports: [DatabaseModule, AuthModule], controllers: [ImageAssetsController], providers: [ImageAssetsService, ImageStorageService], exports: [ImageAssetsService] })
export class ImageAssetsModule {}
