import { Injectable, NotFoundException } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { JobEvent } from "@koreamate/contracts";
import { Observable } from "rxjs";
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

  stream(jobId: string, lastEventId?: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let active = true;
      let cursor = lastEventId;

      const poll = async (): Promise<void> => {
        try {
          while (active) {
            const events = await this.getEvents(jobId, cursor);
            for (const event of events) {
              cursor = event.eventId;
              subscriber.next({ id: event.eventId, type: event.type, data: event });
            }
            const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
            if (!job || job.status === "COMPLETED" || job.status === "FAILED") {
              subscriber.complete();
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        } catch (error) {
          subscriber.error(error);
        }
      };

      void poll();
      return () => { active = false; };
    });
  }
}
