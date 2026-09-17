import {
  AcceptedMessageSchema,
  ConversationSchema,
  type AcceptedMessage,
  type Conversation,
  type ConversationMode,
  SpeechTranscriptionSchema,
  type SpeechTranscription,
  SavedPlaceListSchema,
  SavedPlaceSchema,
  type SavedPlace,
  UserMemoryListSchema,
  type UserMemory,
} from "@koreamate/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100/api/v1";

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//u.test(path)) return path;
  return `${API_URL.replace(/\/api\/v1\/?$/u, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson<T>(path: string, init: RequestInit, parse: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    throw new Error("暂时无法连接 KoreaMate，请稍后再试。");
  }
  return parse(await response.json());
}

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  return requestJson("/auth/me", { method: "GET" }, (value) => value as { id: string; email: string } | null);
}

export async function requestEmailCode(email: string): Promise<void> {
  await requestJson("/auth/email/code", { method: "POST", body: JSON.stringify({ email }) }, () => undefined);
}

export function verifyEmailCode(email: string, code: string): Promise<{ id: string; email: string }> {
  return requestJson("/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) }, (value) => value as { id: string; email: string });
}

export async function logout(): Promise<void> {
  await requestJson("/auth/logout", { method: "POST" }, () => undefined);
}

export function listHistory(): Promise<{ items: Array<{ conversationId: string; mode: ConversationMode; title: string; updatedAt: string; tripId: string | null; confirmed: boolean }> }> {
  return requestJson("/conversations", { method: "GET" }, (value) => value as { items: Array<{ conversationId: string; mode: ConversationMode; title: string; updatedAt: string; tripId: string | null; confirmed: boolean }> });
}

export function getConversation(id: string): Promise<{ id: string; mode: ConversationMode; createdAt: string; timeline: unknown[]; latestPlan: import("@koreamate/contracts").TripPlan | null }> {
  return requestJson(`/conversations/${id}`, { method: "GET" }, (value) => value as { id: string; mode: ConversationMode; createdAt: string; timeline: unknown[]; latestPlan: import("@koreamate/contracts").TripPlan | null });
}

export async function confirmTrip(tripId: string, versionId: string): Promise<void> {
  await requestJson(`/trips/${tripId}/versions/${versionId}/confirm`, { method: "POST" }, () => undefined);
}

export function listConfirmedTrips(): Promise<Array<{ tripId: string; title: string; confirmedAt: string; plan: import("@koreamate/contracts").TripPlan }>> {
  return requestJson("/trips/confirmed", { method: "GET" }, (value) => value as Array<{ tripId: string; title: string; confirmedAt: string; plan: import("@koreamate/contracts").TripPlan }>);
}

export function createConversation(mode: ConversationMode): Promise<Conversation> {
  return requestJson(
    "/conversations",
    { method: "POST", body: JSON.stringify({ mode }) },
    (value) => ConversationSchema.parse(value),
  );
}

export function sendTextMessage(
  conversationId: string,
  text: string,
  idempotencyKey: string,
): Promise<AcceptedMessage> {
  return requestJson(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ content: { type: "TEXT", text } }),
    },
    (value) => AcceptedMessageSchema.parse(value),
  );
}

export function sendImportMessage(conversationId: string, text: string, images: string[], idempotencyKey: string): Promise<AcceptedMessage> {
  return requestJson(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ content: { type: "IMPORT", text, images } }),
  }, (value) => AcceptedMessageSchema.parse(value));
}

export function sendImageTranslationMessage(conversationId: string, text: string, images: string[], idempotencyKey: string): Promise<AcceptedMessage> {
  return requestJson(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ content: { type: "IMAGE_TRANSLATION", text, images } }),
  }, (value) => AcceptedMessageSchema.parse(value));
}

export async function transcribeSpeech(audio: Blob): Promise<SpeechTranscription> {
  const form = new FormData();
  const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `recording.${extension}`);
  const response = await fetch(`${API_URL}/speech/transcriptions`, { method: "POST", credentials: "include", body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    const message = payload?.message;
    if (message === "SPEECH_EMPTY") throw new Error("没有听清，可以重新录制或输入文字。");
    if (message === "SPEECH_SERVICE_UNAVAILABLE") throw new Error("本地语音服务暂不可用，文字和图片翻译仍可使用。");
    throw new Error("语音识别失败，请重试或直接输入文字。");
  }
  return SpeechTranscriptionSchema.parse(await response.json());
}

export function jobEventsUrl(jobId: string): string {
  return `${API_URL}/jobs/${jobId}/events`;
}

export function listSavedPlaces(): Promise<{ items: SavedPlace[] }> {
  return requestJson("/saved-places", { method: "GET" }, (value) => SavedPlaceListSchema.parse(value));
}

export function savePlace(placeId: string, note?: string | null): Promise<SavedPlace> {
  return requestJson("/saved-places", { method: "POST", body: JSON.stringify({ placeId, note }) }, (value) => SavedPlaceSchema.parse(value));
}

export async function deleteSavedPlace(id: string): Promise<void> {
  await requestJson(`/saved-places/${id}`, { method: "DELETE" }, () => undefined);
}

export function listMemories(): Promise<{ items: UserMemory[] }> {
  return requestJson("/memories", { method: "GET" }, (value) => UserMemoryListSchema.parse(value));
}

export async function deleteMemory(id: string): Promise<void> {
  await requestJson(`/memories/${id}`, { method: "DELETE" }, () => undefined);
}
