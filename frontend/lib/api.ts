import {
  AcceptedMessageSchema,
  ConversationSchema,
  type AcceptedMessage,
  type Conversation,
  type ConversationMode,
} from "@koreamate/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100/api/v1";

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

export function jobEventsUrl(jobId: string): string {
  return `${API_URL}/jobs/${jobId}/events`;
}
