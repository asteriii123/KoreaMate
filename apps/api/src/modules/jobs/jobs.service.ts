import { Injectable, NotFoundException } from "@nestjs/common";
import type { JobEvent } from "@koreamate/contracts";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(jobId: string, lastEventId?: string): Promise<JobEvent[]> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const lastEvent = lastEventId
      ? await this.prisma.jobEvent.findFirst({ where: { id: lastEventId, jobId } })
      : undefined;
    const events = await this.prisma.jobEvent.findMany({
      where: { jobId, sequence: lastEvent ? { gt: lastEvent.sequence } : undefined },
      orderBy: { sequence: "asc" },
    });

    return events.map((event) => ({
      eventId: event.id,
      type: event.type as JobEvent["type"],
      occurredAt: event.occurredAt.toISOString(),
      data: event.data as JobEvent["data"],
    }));
  }
}
