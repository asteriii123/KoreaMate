import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@koreamate/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok", service: "koreamate-api", version: "3.0.0" };
  }
}
