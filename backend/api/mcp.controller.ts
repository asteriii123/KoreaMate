import { Controller, Get } from '@nestjs/common'
import { McpRegistryService } from '../agents/tools/mcp-registry'
import { ok } from './types'

@Controller('api/v1/mcp')
export class McpController {
  constructor(private readonly registry: McpRegistryService) {}

  @Get('status') async status() { return ok(await this.registry.status()) }
}
