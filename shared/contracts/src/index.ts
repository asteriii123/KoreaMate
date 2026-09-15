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
  "translation.started",
  "translation.ready",
  "travel.started",
  "travel.question",
  "travel.answer",
  "travel.plan.ready",
  "job.completed",
  "job.failed",
]);

export const TranslationResultSchema = z.object({
  id: z.uuid(),
  sourceLanguage: z.enum(["zh", "ko"]),
  targetLanguage: z.enum(["zh", "ko"]),
  sourceText: z.string().min(1),
  translatedText: z.string().min(1),
  naturalExpression: z.string().min(1),
  pronunciation: z.string().nullable(),
  politeness: z.enum(["casual", "polite", "formal"]),
});

export const ItineraryItemSchema = z.object({
  id: z.uuid(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedCost: z.number().nonnegative(),
  currency: z.string().length(3),
  place: z.object({
    name: z.string().min(1),
    address: z.string().nullable(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    mapUrl: z.url().nullable(),
  }).nullable().default(null),
});

export const ItineraryDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.iso.date().nullable(),
  title: z.string().min(1),
  items: z.array(ItineraryItemSchema).min(1),
  estimatedCost: z.number().nonnegative(),
});

export const WeatherContextSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    source: z.literal("open-meteo"),
    fetchedAt: z.iso.datetime(),
    days: z.array(z.object({
      date: z.iso.date(),
      temperatureMin: z.number(),
      temperatureMax: z.number(),
      precipitationProbability: z.number().min(0).max(100),
      weatherCode: z.number().int(),
    })).min(1).max(16),
  }),
  z.object({
    status: z.literal("pending"),
    reason: z.enum(["date_required", "outside_forecast_range"]),
  }),
]);

export const ExchangeRateContextSchema = z.object({
  source: z.literal("frankfurter"),
  base: z.string().length(3),
  quote: z.literal("KRW"),
  rate: z.number().positive(),
  date: z.iso.date(),
  fetchedAt: z.iso.datetime(),
});

export const TripPlanSchema = z.object({
  tripId: z.uuid(),
  versionId: z.uuid(),
  versionNumber: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  currency: z.string().length(3),
  totalEstimatedCost: z.number().nonnegative(),
  weather: WeatherContextSchema.nullable().default(null),
  exchangeRate: ExchangeRateContextSchema.nullable().default(null),
  days: z.array(ItineraryDaySchema).min(1),
});

export const PlaceResultSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  address: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string().nullable(),
  provider: z.enum(["kakao", "korea-tourism"]),
  sourceUrl: z.url().nullable(),
  fetchedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const ProviderStatusSchema = z.object({
  id: z.enum(["kakao", "korea-tourism", "naver", "weather", "exchange-rate"]),
  configured: z.boolean(),
});

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
export type TranslationResult = z.infer<typeof TranslationResultSchema>;
export type TripPlan = z.infer<typeof TripPlanSchema>;
export type WeatherContext = z.infer<typeof WeatherContextSchema>;
export type ExchangeRateContext = z.infer<typeof ExchangeRateContextSchema>;
export type PlaceResult = z.infer<typeof PlaceResultSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
