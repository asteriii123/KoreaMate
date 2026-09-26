import { describe, expect, it, vi } from "vitest";
import { speakKorean, speechSynthesisSupported, stopSpeaking } from "./speech-synthesis.js";

describe("Korean speech synthesis", () => {
  it("prefers a Korean voice and can stop", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class Utterance { lang = ""; voice: unknown = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} }
    const target = { SpeechSynthesisUtterance: Utterance, speechSynthesis: { cancel, speak, getVoices: () => [{ lang: "en-US" }, { lang: "ko-KR" }] } } as unknown as Window;
    expect(speechSynthesisSupported(target)).toBe(true);
    expect(speakKorean("안녕하세요", vi.fn(), target)).toBe(true);
    expect(speak.mock.calls[0]?.[0]).toMatchObject({ lang: "ko-KR", voice: { lang: "ko-KR" } });
    stopSpeaking(target);
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
