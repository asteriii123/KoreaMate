import { Controller, Headers, MessageEvent, Param, Sse } from "@nestjs/common";
import { from, map, mergeMap, type Observable } from "rxjs";
import { JobsService } from "./jobs.service.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Sse(":id/events")
  events(
    @Param("id") jobId: string,
    @Headers("last-event-id") lastEventId?: string,
  ): Observable<MessageEvent> {
    return from(this.jobs.getEvents(jobId, lastEventId)).pipe(
      mergeMap((events) => from(events)),
      map((event) => ({
        id: event.eventId,
        type: event.type,
        data: event,
      })),
    );
  }
}
