import { Injectable } from '@nestjs/common'
import { BaseInspirationProvider } from './base-inspiration-provider'
@Injectable()
export class WeiboProvider extends BaseInspirationProvider { readonly platform = 'weibo' as const; readonly enabled = false; protected readonly samples = [] }
