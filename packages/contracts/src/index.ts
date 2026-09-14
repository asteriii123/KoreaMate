import { z } from "zod";

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
