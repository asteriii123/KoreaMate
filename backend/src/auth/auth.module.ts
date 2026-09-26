import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { IdentityService } from "./identity.service.js";

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, IdentityService], exports: [IdentityService] })
export class AuthModule {}
