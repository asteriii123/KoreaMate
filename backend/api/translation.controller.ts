import { Body, Controller, Post } from '@nestjs/common'
import { ok } from './types'
import { TextTranslationDto } from './requests'
import { TranslationService } from '../services/translation.service'
@Controller('api/v1/translations')
export class TranslationController {
  constructor(private readonly service: TranslationService) {}
  @Post('text') async translate(@Body() input: TextTranslationDto) { return ok(await this.service.translate(input)) }
}
