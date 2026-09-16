import { BadRequestException, Controller, Post, Req, Res } from "@nestjs/common";
import type { SpeechTranscription } from "@koreamate/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { IdentityService } from "../auth/identity.service.js";
import { SpeechService } from "./speech.service.js";

@Controller("speech")
export class SpeechController {
  constructor(private readonly speech: SpeechService, private readonly identity: IdentityService) {}

  @Post("transcriptions")
  async transcribe(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<SpeechTranscription> {
    await this.identity.resolve(request, reply);
    let file;
    try {
      file = await request.file({ limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
    } catch {
      throw new BadRequestException("SPEECH_FILE_TOO_LARGE");
    }
    if (!file) throw new BadRequestException("SPEECH_EMPTY");
    try {
      return this.speech.transcribe({ buffer: await file.toBuffer(), mimeType: file.mimetype, filename: file.filename || "recording.webm" });
    } catch (error) {
      if (file.file.truncated) throw new BadRequestException("SPEECH_FILE_TOO_LARGE");
      throw error;
    }
  }
}
