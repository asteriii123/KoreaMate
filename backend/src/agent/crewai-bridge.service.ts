import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AgentRunStoreService } from "./agent-run-store.service.js";

type AgentRunRequest = {
  runId: string;
  conversationId: string;
  jobId: string;
  userId: string | null;
  guestId: string | null;
  message: string;
  attachments?: unknown[];
  recentMessages?: Array<{ role: string; text: string }>;
  requirements?: Record<string, unknown> | null;
  previousPlan?: Record<string, unknown> | null;
};

@Injectable()
export class CrewAiBridgeService {
  constructor(private readonly runs: AgentRunStoreService) {}
  async run(request: AgentRunRequest): Promise<unknown> {
    const baseUrl = process.env.CREWAI_AGENT_URL ?? "http://127.0.0.1:8010";
    await this.runs.start({ id: request.runId, conversationId: request.conversationId, jobId: request.jobId, model: process.env.CREWAI_MODEL_NAME });
    try {
      const response = await fetch(`${baseUrl}/agent/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          run_id: request.runId,
          conversation_id: request.conversationId,
          job_id: request.jobId,
          user_id: request.userId,
          guest_id: request.guestId,
          message: request.message,
          attachments: request.attachments ?? [],
          recent_messages: request.recentMessages ?? [],
          requirements: request.requirements ?? null,
          previous_plan: request.previousPlan ?? null,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`CrewAI returned ${response.status}`);
      const result = await response.json();
      await this.runs.finish(request.runId, "COMPLETED", result);
      return result;
    } catch (error) {
      await this.runs.finish(request.runId, "FAILED", { error: String(error) });
      throw new ServiceUnavailableException(`CrewAI agent unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
