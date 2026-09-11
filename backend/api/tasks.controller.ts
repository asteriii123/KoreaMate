import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common'
import { ok } from './types'
import { TasksService } from '../services/tasks.service'
@Controller('api/v1')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Post('media-tasks') createMedia(@Body() body: { type: 'voice' | 'video' }) { const task = this.tasks.create(body.type === 'video' ? 'video' : 'voice'); void this.simulate(task.id); return ok({ taskId: task.id, statusUrl: `/api/v1/tasks/${task.id}`, eventsUrl: `/api/v1/tasks/${task.id}/events` }) }
  @Get('tasks/:taskId') get(@Param('taskId') id: string) { return ok(this.tasks.get(id)) }
  @Sse('tasks/:taskId/events') events(@Param('taskId') id: string) { return this.tasks.events(id) }
  private async simulate(id: string) { for (const [stage, progress] of [['research', 35], ['planning', 70], ['completed', 100]] as const) { await new Promise((resolve) => setTimeout(resolve, 350)); this.tasks.update(id, { stage, progress }) } }
}
