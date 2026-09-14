import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { config } from "dotenv";
import { resolve } from "node:path";
import { AppModule } from "./app.module.js";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ path: resolve(process.cwd(), ".env"), override: true, quiet: true });
const legacyEnvironment: Record<string, string> = {};
config({ path: resolve(process.cwd(), "../../backend/.env"), processEnv: legacyEnvironment, quiet: true });
for (const name of ["LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL"] as const) {
  process.env[name] ??= legacyEnvironment[name];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api/v1");
  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001").split(",");
  app.enableCors({ origin: allowedOrigins });
  await app.listen(Number(process.env.PORT ?? 3100));
}

void bootstrap();
