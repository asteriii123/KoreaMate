import { z } from "zod";

export const ConversationModeSchema = z.enum(["TRAVEL", "TRANSLATION"]);

export const CreateConversationRequestSchema = z.object({
  mode: ConversationModeSchema,
});

export const ConversationSchema = z.object({
  id: z.uuid(),
  mode: ConversationModeSchema,
  createdAt: z.iso.datetime(),
});

export const TextMessageContentSchema = z.object({
  type: z.literal("TEXT"),
  text: z.string().trim().min(1).max(4_000),
});

export const SendMessageRequestSchema = z.object({
  content: TextMessageContentSchema,
});

export const AcceptedMessageSchema = z.object({
  messageId: z.uuid(),
  jobId: z.uuid(),
  status: z.literal("ACCEPTED"),
});

export const JobEventTypeSchema = z.enum([
  "message.accepted",
  "job.completed",
  "job.failed",
]);

export const JobEventSchema = z.object({
  eventId: z.uuid(),
  type: JobEventTypeSchema,
  occurredAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    requestId: z.uuid(),
  }),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("koreamate-api"),
  version: z.string().min(1),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ConversationMode = z.infer<typeof ConversationModeSchema>;
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type AcceptedMessage = z.infer<typeof AcceptedMessageSchema>;
export type JobEvent = z.infer<typeof JobEventSchema>;
