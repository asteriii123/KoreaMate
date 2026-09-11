import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Queue } from 'bullmq'
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue = process.env.REDIS_URL ? new Queue('koreamate', { connection: { url: process.env.REDIS_URL } }) : null
  get enabled() { return Boolean(this.queue) }
  async add(name: string, data: object) { if (!this.queue) return null; return this.queue.add(name, data, { attempts: 2, removeOnComplete: 100, removeOnFail: 100 }) }
  async onModuleDestroy() { await this.queue?.close() }
}

