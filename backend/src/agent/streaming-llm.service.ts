import { Injectable } from "@nestjs/common";

type StreamDelta = { choices?: Array<{ delta?: { content?: string | null } }> };

@Injectable()
export class StreamingLlmService {
  /** 以 OpenAI 兼容的 `stream: true` 调用 LLM，逐段产出文本增量。 */
  async *streamReply(input: { system: string; user: string }): AsyncGenerator<string> {
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL;
    const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    if (!apiKey || !model) throw new Error("LLM is not configured");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        stream: true,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok || !response.body) throw new Error(`LLM stream returned HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        let parsed: StreamDelta;
        try {
          parsed = JSON.parse(payload) as StreamDelta;
        } catch {
          continue;
        }
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
    }
  }
}
