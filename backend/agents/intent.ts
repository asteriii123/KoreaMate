import { Injectable } from '@nestjs/common'
import type { CreateTravelPlanDto } from '../api/requests'
@Injectable()
export class IntentAgent { run(input: CreateTravelPlanDto) { return { ...input, interests: [...new Set(input.interests)].slice(0, 10) } } }
