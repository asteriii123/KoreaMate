export type SpeechRecognitionErrorCode = "not-allowed" | "service-not-allowed" | "no-speech" | "audio-capture" | "network" | string;

type RecognitionResultEvent = { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type RecognitionErrorEvent = { error: SpeechRecognitionErrorCode };

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionConstructor = new () => RecognitionInstance;
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };

export type SpeechRecognitionController = { start(): void; stop(): void; destroy(): void };

export function speechRecognitionSupported(target: Window = window): boolean {
  const value = target as SpeechWindow;
  return Boolean(value.SpeechRecognition ?? value.webkitSpeechRecognition);
}

export function speechRecognitionErrorMessage(code: SpeechRecognitionErrorCode): string {
  if (code === "not-allowed" || code === "service-not-allowed") return "请允许浏览器使用麦克风后再试。";
  if (code === "no-speech") return "没有听清，可以重试或直接输入文字。";
  if (code === "audio-capture") return "没有找到可用的麦克风。";
  return "语音识别暂时不可用，仍可直接输入文字。";
}

export function createSpeechRecognition(options: {
  language: "zh-CN" | "ko-KR";
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
  target?: Window;
}): SpeechRecognitionController | null {
  const target = (options.target ?? window) as SpeechWindow;
  const Constructor = target.SpeechRecognition ?? target.webkitSpeechRecognition;
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = options.language;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0]?.transcript ?? "").join(" ").trim();
    if (text) options.onResult(text);
  };
  recognition.onerror = (event) => options.onError(speechRecognitionErrorMessage(event.error));
  recognition.onend = options.onEnd;
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    destroy: () => { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); },
  };
}

export function recognitionLanguage(text: string): "zh-CN" | "ko-KR" {
  return /[\uac00-\ud7af]/u.test(text) ? "ko-KR" : "zh-CN";
}
