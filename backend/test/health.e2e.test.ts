import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@koreamate/contracts";
import { HealthModule } from "../src/modules/health/health.module.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("health endpoint", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns the versioned API health contract", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1");
    await app.init();

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json()).status).toBe("ok");
  });
});
