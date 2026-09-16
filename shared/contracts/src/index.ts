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

export const UserSchema = z.object({ id: z.uuid(), email: z.email() });
export const RequestEmailCodeSchema = z.object({ email: z.email().max(254) });
export const VerifyEmailCodeSchema = z.object({ email: z.email().max(254), code: z.string().regex(/^\d{6}$/) });
export const HistoryItemSchema = z.object({
  conversationId: z.uuid(),
  mode: ConversationModeSchema,
  title: z.string().min(1),
  updatedAt: z.iso.datetime(),
  tripId: z.uuid().nullable(),
  confirmed: z.boolean(),
});
export const HistoryListSchema = z.object({ items: z.array(HistoryItemSchema) });

export const TextMessageContentSchema = z.object({
  type: z.literal("TEXT"),
  text: z.string().trim().min(1).max(4_000),
});

export const ImportMessageContentSchema = z.object({
  type: z.literal("IMPORT"),
  text: z.string().trim().max(4_000).default(""),
  images: z.array(z.string().max(2_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,/)).max(4).default([]),
}).refine((value) => value.text.length > 0 || value.images.length > 0, { message: "A link, text, or image is required" });

export const ImageTranslationMessageContentSchema = z.object({
  type: z.literal("IMAGE_TRANSLATION"),
  text: z.string().trim().max(1_000).default(""),
  images: z.array(z.string().max(2_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,/)).min(1).max(4),
});

export const SendMessageRequestSchema = z.object({
  content: z.discriminatedUnion("type", [TextMessageContentSchema, ImportMessageContentSchema, ImageTranslationMessageContentSchema]),
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
  "translation.image.started",
  "translation.image.ocr.ready",
  "translation.image.ready",
  "travel.started",
  "travel.question",
  "travel.answer",
  "travel.import.ready",
  "travel.hotel.ready",
  "travel.flight.ready",
  "travel.plan.ready",
  "travel.trip.confirmed",
  "travel.saved-place.ready",
  "travel.saved-place.question",
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

export const SpeechTranscriptionSchema = z.object({
  text: z.string().trim().min(1),
  language: z.string().trim().min(2).max(8),
  languageProbability: z.number().min(0).max(1),
  duration: z.number().nonnegative().max(35),
});

export const ImageTranslationResultSchema = z.object({
  kind: z.enum(["text", "menu", "unknown"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceText: z.string().min(1),
  sections: z.array(z.object({ source: z.string().min(1), translation: z.string().min(1) })).max(40),
  menuItems: z.array(z.object({
    name: z.string().min(1),
    originalName: z.string().min(1),
    description: z.string(),
    price: z.string().nullable(),
  })).max(40),
  uncertainText: z.array(z.string().min(1)).max(30),
  provider: z.object({ ocr: z.string().min(1), translation: z.string().min(1) }),
});

export const ItineraryItemSchema = z.object({
  id: z.uuid(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedCost: z.number().nonnegative(),
  currency: z.string().length(3),
  place: z.object({
    id: z.uuid(),
    name: z.string().min(1),
    nameZh: z.string().min(1).nullable().default(null),
    address: z.string().nullable(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    mapUrl: z.url().nullable(),
    saved: z.boolean().default(false),
  }).nullable().default(null),
});

export const SavedPlaceSchema = z.object({
  id: z.uuid(),
  placeId: z.uuid(),
  name: z.string().min(1),
  nameZh: z.string().min(1).nullable(),
  address: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  mapUrl: z.url().nullable(),
  note: z.string().max(240).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const SavedPlaceListSchema = z.object({ items: z.array(SavedPlaceSchema) });
export const CreateSavedPlaceRequestSchema = z.object({ placeId: z.uuid(), note: z.string().trim().max(240).nullable().optional() });
export const UpdateSavedPlaceRequestSchema = z.object({ note: z.string().trim().max(240).nullable() });

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

export const HotelOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  starRating: z.number().min(0).max(5).nullable(),
  lowestPrice: z.number().nonnegative(),
  currency: z.string().length(3),
  address: z.string().nullable(),
  imageUrl: z.url().nullable(),
  bookingUrl: z.url().nullable(),
  recommendation: z.string(),
  cancellation: z.string(),
});

export const HotelSearchResultSchema = z.object({
  provider: z.literal("rollinggo-hotel"),
  destination: z.string().min(1),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  hotels: z.array(HotelOptionSchema).max(6),
});

export const FlightOptionSchema = z.object({
  id: z.string().min(1),
  flightNumbers: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  duration: z.string().min(1),
  direct: z.boolean(),
  transferCity: z.string().nullable(),
  price: z.number().nonnegative(),
  currency: z.literal("CNY"),
});

export const FlightSearchResultSchema = z.object({
  provider: z.literal("variflight"),
  fromCity: z.string().min(1),
  toCity: z.string().min(1),
  departureDate: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  flights: z.array(FlightOptionSchema).max(8),
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
  hotels: z.array(HotelOptionSchema).max(3).default([]),
  flights: z.array(FlightOptionSchema).max(3).default([]),
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

export const GuideImportPreviewSchema = z.object({
  id: z.uuid(),
  sourceCount: z.number().int().positive(),
  failedSourceCount: z.number().int().nonnegative(),
  needsFallback: z.boolean(),
  items: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(["attraction", "restaurant", "hotel", "shopping", "other"]),
    note: z.string(),
    verified: z.boolean(),
    place: PlaceResultSchema.nullable(),
  })).max(30),
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
export type GuideImportPreview = z.infer<typeof GuideImportPreviewSchema>;
export type AcceptedMessage = z.infer<typeof AcceptedMessageSchema>;
export type JobEvent = z.infer<typeof JobEventSchema>;
export type TranslationResult = z.infer<typeof TranslationResultSchema>;
export type SpeechTranscription = z.infer<typeof SpeechTranscriptionSchema>;
export type ImageTranslationResult = z.infer<typeof ImageTranslationResultSchema>;
export type TripPlan = z.infer<typeof TripPlanSchema>;
export type WeatherContext = z.infer<typeof WeatherContextSchema>;
export type ExchangeRateContext = z.infer<typeof ExchangeRateContextSchema>;
export type HotelOption = z.infer<typeof HotelOptionSchema>;
export type HotelSearchResult = z.infer<typeof HotelSearchResultSchema>;
export type FlightOption = z.infer<typeof FlightOptionSchema>;
export type FlightSearchResult = z.infer<typeof FlightSearchResultSchema>;
export type PlaceResult = z.infer<typeof PlaceResultSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type User = z.infer<typeof UserSchema>;
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export type SavedPlace = z.infer<typeof SavedPlaceSchema>;
