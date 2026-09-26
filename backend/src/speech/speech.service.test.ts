import { describe, expect, it, vi } from "vitest";
import { SpeechService } from "./speech.service.js";
import { WhisperProvider } from "./whisper.js";

describe("SpeechService", () => {
  it("rejects unsupported audio before calling Whisper", async () => {
    const whisper = { transcribe: vi.fn() } as unknown as WhisperProvider;
    await expect(new SpeechService(whisper).transcribe({ buffer: Buffer.from("x"), mimeType: "text/plain", filename: "x.txt" })).rejects.toThrow("SPEECH_UNSUPPORTED_FORMAT");
    expect(whisper.transcribe).not.toHaveBeenCalled();
  });

  it("returns a valid Whisper transcription", async () => {
    const value = { text: "안녕하세요", language: "ko", languageProbability: 0.98, duration: 1.2 };
    const whisper = { transcribe: vi.fn().mockResolvedValue(value) } as unknown as WhisperProvider;
    await expect(new SpeechService(whisper).transcribe({ buffer: Buffer.from("audio"), mimeType: "audio/webm", filename: "voice.webm" })).resolves.toEqual(value);
  });
});
