type SpeechWindow = Window & { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance };

export function speechSynthesisSupported(target: Window = window): boolean {
  return "speechSynthesis" in target && Boolean((target as SpeechWindow).SpeechSynthesisUtterance);
}

export function speakKorean(text: string, onEnd: () => void, target: Window = window): boolean {
  if (!speechSynthesisSupported(target)) return false;
  target.speechSynthesis.cancel();
  const Utterance = (target as SpeechWindow).SpeechSynthesisUtterance;
  if (!Utterance) return false;
  const utterance = new Utterance(text);
  utterance.lang = "ko-KR";
  utterance.voice = target.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  target.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(target: Window = window): void {
  if ("speechSynthesis" in target) target.speechSynthesis.cancel();
}
