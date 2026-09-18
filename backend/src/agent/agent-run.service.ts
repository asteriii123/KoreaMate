import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AgentRunService {
  constructor(private readonly prisma: PrismaService) {}

  start(input: { id: string; conversationId: string; jobId: string; model?: string }): Promise<unknown> {
    return this.prisma.agentRun.create({ data: { id: input.id, conversationId: input.conversationId, jobId: input.jobId, model: input.model, status: "RUNNING" } });
  }

  async finish(id: string, status: "COMPLETED" | "FAILED", output?: unknown): Promise<void> {
    await this.prisma.agentRun.update({ where: { id }, data: { status, completedAt: new Date() } });
    if (output !== undefined) await this.prisma.agentStep.create({ data: { runId: id, sequence: 1, kind: "final", input: {}, output: JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue } });
  }
}
