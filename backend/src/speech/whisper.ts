import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { SpeechTranscriptionSchema, type SpeechTranscription } from "@koreamate/contracts";

@Injectable()
export class WhisperProvider {
  async transcribe(input: { buffer: Buffer; mimeType: string; filename: string }): Promise<SpeechTranscription> {
    const url = process.env.WHISPER_SERVICE_URL;
    if (!url) throw new ServiceUnavailableException("SPEECH_SERVICE_UNAVAILABLE");
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename);
    let response: Response;
    try {
      response = await fetch(`${url.replace(/\/$/u, "")}/transcriptions`, { method: "POST", body: form, signal: AbortSignal.timeout(90_000) });
    } catch {
      throw new ServiceUnavailableException("SPEECH_SERVICE_UNAVAILABLE");
    }
    if (response.status === 422) throw new Error("SPEECH_EMPTY");
    if (!response.ok) throw new ServiceUnavailableException("SPEECH_TRANSCRIPTION_FAILED");
    return SpeechTranscriptionSchema.parse(await response.json());
  }
}
