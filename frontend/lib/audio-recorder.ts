const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
type AudioWindow = Window & { MediaRecorder?: typeof MediaRecorder };

export type AudioRecorderController = { stop(): void; destroy(): void };

export function audioRecordingSupported(target: Window = window): boolean {
  return Boolean(target.navigator.mediaDevices && (target as AudioWindow).MediaRecorder);
}

export function preferredAudioMimeType(Recorder: typeof MediaRecorder = MediaRecorder): string {
  return MIME_TYPES.find((type) => Recorder.isTypeSupported(type)) ?? "";
}

export function recorderErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "请允许浏览器使用麦克风后再试。";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "没有找到可用的麦克风。";
  return "无法开始录音，仍可直接输入文字。";
}

export async function createAudioRecorder(options: {
  onComplete: (audio: Blob) => void;
  onError: (message: string) => void;
  maxDurationMs?: number;
  target?: Window;
}): Promise<AudioRecorderController> {
  const target = options.target ?? window;
  if (!audioRecordingSupported(target)) throw new Error("当前浏览器暂不支持录音。");
  const stream = await target.navigator.mediaDevices.getUserMedia({ audio: true });
  const Recorder = (target as AudioWindow).MediaRecorder;
  if (!Recorder) throw new Error("当前浏览器暂不支持录音。");
  const mimeType = preferredAudioMimeType(Recorder);
  const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  let destroyed = false;
  const timer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, options.maxDurationMs ?? 30_000);
  const release = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
  };
  recorder.ondataavailable = (event: BlobEvent) => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = () => { release(); if (!destroyed) options.onError("录音失败，请重试或直接输入文字。"); };
  recorder.onstop = () => {
    release();
    if (!destroyed) options.onComplete(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
  };
  recorder.start();
  return {
    stop: () => { if (recorder.state === "recording") recorder.stop(); },
    destroy: () => { destroyed = true; if (recorder.state === "recording") recorder.stop(); else release(); },
  };
}
