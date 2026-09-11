import { Injectable } from '@nestjs/common'
import { TasksService } from '../services/tasks.service'
import type { CreateTravelPlanDto } from '../api/requests'
import { CriticAgent } from './critic'
import { IntentAgent } from './intent'
import { PlannerAgent } from './planner'
import { ResearchAgent } from './research'
@Injectable()
export class CoordinatorService {
  private readonly plans = new Map<string, unknown>()
  constructor(private readonly tasks: TasksService, private readonly intent: IntentAgent, private readonly research: ResearchAgent, private readonly planner: PlannerAgent, private readonly critic: CriticAgent) {}
  create(input: CreateTravelPlanDto) { const task = this.tasks.create('travel'); void this.run(task.id, input); return { taskId: task.id, statusUrl: `/api/v1/tasks/${task.id}`, eventsUrl: `/api/v1/tasks/${task.id}/events` } }
  getPlan(id: string) { return this.plans.get(id) }
  private async run(taskId: string, raw: CreateTravelPlanDto) { try { this.tasks.update(taskId, { stage: 'intent', progress: 15 }); const input = this.intent.run(raw); await this.pause(); this.tasks.update(taskId, { stage: 'research', progress: 35 }); const research = await this.research.run(input); await this.pause(); this.tasks.update(taskId, { stage: 'planning', progress: 65 }); const draft = this.planner.run(input, research.places, research.inspirations); await this.pause(); this.tasks.update(taskId, { stage: 'review', progress: 85 }); const plan = this.critic.run(draft); this.plans.set(draft.id, plan); await this.pause(); this.tasks.update(taskId, { stage: 'completed', progress: 100, resultId: draft.id }) } catch (error) { this.tasks.update(taskId, { stage: 'failed', error: error instanceof Error ? error.message : '行程生成失败' }) } }
  private pause() { return new Promise((resolve) => setTimeout(resolve, 250)) }
}
