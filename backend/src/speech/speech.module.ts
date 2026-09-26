import { Module } from "@nestjs/common";
import { SpeechController } from "./speech.controller.js";
import { SpeechService } from "./speech.service.js";
import { WhisperProvider } from "./whisper.js";

@Module({ controllers: [SpeechController], providers: [SpeechService, WhisperProvider] })
export class SpeechModule {}
