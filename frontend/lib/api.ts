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
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    throw new Error("暂时无法连接 KoreaMate，请稍后再试。");
  }
  return parse(await response.json());
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

export function jobEventsUrl(jobId: string): string {
  return `${API_URL}/jobs/${jobId}/events`;
}
