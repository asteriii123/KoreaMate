import { Injectable, NotFoundException } from '@nestjs/common'
import { BehaviorSubject, map } from 'rxjs'
export type TaskStage = 'queued' | 'intent' | 'research' | 'planning' | 'review' | 'completed' | 'failed'
export interface TaskRecord { id: string; type: 'travel' | 'voice' | 'video'; stage: TaskStage; progress: number; resultId?: string; error?: string; updatedAt: string }
@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, BehaviorSubject<TaskRecord>>()
  create(type: TaskRecord['type']) { const task: TaskRecord = { id: crypto.randomUUID(), type, stage: 'queued', progress: 0, updatedAt: new Date().toISOString() }; this.tasks.set(task.id, new BehaviorSubject(task)); return task }
  get(id: string) { const task = this.tasks.get(id)?.value; if (!task) throw new NotFoundException('任务不存在或已过期'); return task }
  update(id: string, patch: Partial<TaskRecord>) { const stream = this.tasks.get(id); if (!stream) return; stream.next({ ...stream.value, ...patch, updatedAt: new Date().toISOString() }) }
  events(id: string) { const stream = this.tasks.get(id); if (!stream) throw new NotFoundException('任务不存在或已过期'); return stream.pipe(map((data) => ({ data }))) }
}

