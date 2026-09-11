export interface LlmRequest { system?: string; prompt: string }
export interface LlmResponse { text: string; provider: 'remote' | 'local-fallback' }
export interface LlmProvider { generateText(request: LlmRequest): Promise<LlmResponse> }

