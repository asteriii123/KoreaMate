import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { SpeechTranscription } from "@koreamate/contracts";
import { WhisperProvider } from "./whisper.js";

const ALLOWED_TYPES = new Set(["audio/webm", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/ogg", "audio/wav", "audio/x-wav"]);

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(private readonly whisper: WhisperProvider) {}

  async transcribe(input: { buffer: Buffer; mimeType: string; filename: string }): Promise<SpeechTranscription> {
    if (!input.buffer.length) throw new BadRequestException("SPEECH_EMPTY");
    const mimeType = input.mimeType.split(";", 1)[0]?.toLowerCase() ?? "";
    if (!ALLOWED_TYPES.has(mimeType)) throw new BadRequestException("SPEECH_UNSUPPORTED_FORMAT");
    if (input.buffer.length > 10 * 1024 * 1024) throw new BadRequestException("SPEECH_FILE_TOO_LARGE");
    const startedAt = Date.now();
    try {
      const result = await this.whisper.transcribe({ ...input, mimeType });
      this.logger.log(`Speech transcription completed bytes=${input.buffer.length} language=${result.language} durationMs=${Date.now() - startedAt}`);
      return result;
    } catch (error) {
      this.logger.error(`Speech transcription failed bytes=${input.buffer.length} error=${error instanceof Error ? error.name : "UnknownError"}`);
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.message === "SPEECH_EMPTY") throw new BadRequestException("SPEECH_EMPTY");
      throw new ServiceUnavailableException("SPEECH_TRANSCRIPTION_FAILED");
    }
  }
}
