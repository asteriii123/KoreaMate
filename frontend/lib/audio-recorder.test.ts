import { describe, expect, it, vi } from "vitest";
import { audioRecordingSupported, createAudioRecorder, preferredAudioMimeType, recorderErrorMessage } from "./audio-recorder.js";

class FakeRecorder {
  static isTypeSupported = (type: string) => type === "audio/webm";
  static latest: FakeRecorder;
  state = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) { this.mimeType = options?.mimeType ?? ""; FakeRecorder.latest = this; }
  start(): void { this.state = "recording"; }
  stop(): void { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
}

describe("audio recorder", () => {
  it("selects a supported MIME type", () => {
    expect(preferredAudioMimeType(FakeRecorder as unknown as typeof MediaRecorder)).toBe("audio/webm");
  });

  it("records and releases microphone tracks", async () => {
    const stopTrack = vi.fn();
    const onComplete = vi.fn();
    const target = { MediaRecorder: FakeRecorder, navigator: { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } } } as unknown as Window;
    expect(audioRecordingSupported(target)).toBe(true);
    const controller = await createAudioRecorder({ onComplete, onError: vi.fn(), target });
    controller.stop();
    expect(onComplete).toHaveBeenCalledWith(expect.any(Blob));
    expect(stopTrack).toHaveBeenCalled();
  });

  it("maps denied microphone permission", () => {
    expect(recorderErrorMessage(new DOMException("denied", "NotAllowedError"))).toContain("允许");
  });
});
