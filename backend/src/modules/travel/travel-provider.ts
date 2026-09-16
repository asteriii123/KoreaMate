import { z } from "zod";

export const TRAVEL_PROVIDER = Symbol("TRAVEL_PROVIDER");

export const TripRequirementsSchema = z.object({
  destination: z.string().trim().min(1).nullable(),
  departureCity: z.string().trim().min(1).nullable(),
  startDate: z.iso.date().nullable(),
  days: z.number().int().min(1).max(30).nullable(),
  travelers: z.number().int().min(1).max(20).nullable(),
  budget: z.number().positive().nullable(),
  currency: z.string().length(3).default("CNY"),
  interests: z.array(z.string().trim().min(1)).max(8),
  pace: z.enum(["relaxed", "balanced", "packed"]).nullable(),
  constraints: z.array(z.string().trim().min(1)).max(12),
});

const ProviderItemSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  estimatedCost: z.number().nonnegative(),
  placeQuery: z.union([z.string().trim().regex(/[가-힣]/), z.null()]),
});

const ProviderDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.iso.date().nullable(),
  title: z.string().trim().min(1),
  items: z.array(ProviderItemSchema).min(1).max(8),
});

export const TravelProviderResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("question"),
    requirements: TripRequirementsSchema,
    question: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("plan"),
    requirements: TripRequirementsSchema,
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    days: z.array(ProviderDaySchema).min(1).max(30),
  }),
]);

export type TripRequirements = z.infer<typeof TripRequirementsSchema>;
export type TravelProviderResult = z.infer<typeof TravelProviderResultSchema>;
export const PendingFieldSchema = z.enum(["destination", "startDate", "days", "travelers", "budget"]);
export type PendingField = z.infer<typeof PendingFieldSchema>;
export type TravelMemoryContext = { departureCity: string | null; budgetLevel: "economy" | "balanced" | "comfortable" | null; pace: "relaxed" | "balanced" | "packed" | null; interests: string[]; constraints: string[] };

export interface TravelProvider {
  readonly name: string;
  plan(input: {
    message: string;
    requirements: TripRequirements | null;
    previousPlan: unknown | null;
    pendingField: PendingField | null;
    today: string;
    memory: TravelMemoryContext;
  }): Promise<TravelProviderResult>;
}

export class TravelProviderNotConfiguredError extends Error {
  constructor() {
    super("Travel provider is not configured");
  }
}
