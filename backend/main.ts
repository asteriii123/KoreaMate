import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { ApiExceptionFilter } from './api/exception.filter'
import { AppModule } from './app.module'
async function bootstrap() { const app = await NestFactory.create(AppModule); app.use(cookieParser(process.env.COOKIE_SECRET ?? 'koreamate-local-development')); app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', credentials: true }); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); app.useGlobalFilters(new ApiExceptionFilter()); await app.listen(Number(process.env.PORT ?? 3000)) }
void bootstrap()
