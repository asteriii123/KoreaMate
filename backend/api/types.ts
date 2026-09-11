export interface ApiSuccess<T> { success: true; data: T; requestId: string }
export interface ApiFailure { success: false; error: { code: string; message: string; retryable: boolean }; requestId: string }
export const ok = <T>(data: T): ApiSuccess<T> => ({ success: true, data, requestId: crypto.randomUUID() })

