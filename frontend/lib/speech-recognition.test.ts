import { describe, expect, it, vi } from "vitest";
import { createSpeechRecognition, recognitionLanguage, speechRecognitionErrorMessage, speechRecognitionSupported } from "./speech-recognition.js";

class FakeRecognition {
  static latest: FakeRecognition;
  lang = "";
  continuous = true;
  interimResults = true;
  onresult: ((event: never) => void) | null = null;
  onerror: ((event: never) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { FakeRecognition.latest = this; }
}

describe("browser speech recognition", () => {
  it("detects support and configures Korean recognition", () => {
    const onResult = vi.fn();
    const target = { webkitSpeechRecognition: FakeRecognition } as unknown as Window;
    expect(speechRecognitionSupported(target)).toBe(true);
    const controller = createSpeechRecognition({ language: "ko-KR", onResult, onError: vi.fn(), onEnd: vi.fn(), target });
    expect(controller).not.toBeNull();
    controller?.start();
    expect(FakeRecognition.latest.lang).toBe("ko-KR");
    FakeRecognition.latest.onresult?.({ results: [{ isFinal: true, 0: { transcript: "안녕하세요" } }] } as never);
    expect(onResult).toHaveBeenCalledWith("안녕하세요");
  });

  it("chooses language from existing Korean text", () => {
    expect(recognitionLanguage("안녕하세요")).toBe("ko-KR");
    expect(recognitionLanguage("你好")).toBe("zh-CN");
  });

  it("maps permission and empty speech errors", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toContain("允许");
    expect(speechRecognitionErrorMessage("no-speech")).toContain("没有听清");
  });
});
