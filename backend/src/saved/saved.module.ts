import { Module } from "@nestjs/common";
import { SavedPlacesController } from "./saved.controller.js";
import { SavedPlacesService } from "./saved.service.js";

@Module({ controllers: [SavedPlacesController], providers: [SavedPlacesService], exports: [SavedPlacesService] })
export class SavedPlacesModule {}
