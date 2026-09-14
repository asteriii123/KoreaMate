import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api/v1");
  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001").split(",");
  app.enableCors({ origin: allowedOrigins });
  await app.listen(Number(process.env.PORT ?? 3100));
}

void bootstrap();
