import { Controller, Headers, MessageEvent, Param, Sse } from "@nestjs/common";
import type { Observable } from "rxjs";
import { JobsService } from "./jobs.service.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Sse(":id/events")
  events(
    @Param("id") jobId: string,
    @Headers("last-event-id") lastEventId?: string,
  ): Observable<MessageEvent> {
    return this.jobs.stream(jobId, lastEventId);
  }
}
