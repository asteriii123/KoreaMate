import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ImageAssetsController } from "./image-assets.controller.js";
import { ImageAssetsService } from "./image-assets.service.js";
import { ImageStorageService } from "./image-storage.service.js";

@Module({ imports: [DatabaseModule, AuthModule], controllers: [ImageAssetsController], providers: [ImageAssetsService, ImageStorageService], exports: [ImageAssetsService] })
export class ImageAssetsModule {}
