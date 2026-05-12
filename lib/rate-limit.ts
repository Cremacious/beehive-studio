import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

function makeRatelimit(prefix: string, limiter: ReturnType<typeof Ratelimit.slidingWindow>) {
  if (!upstashConfigured) {
    return {
      limit: async () => ({ success: true, limit: 0, remaining: 999, reset: 0 }),
    } as unknown as Ratelimit
  }
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter,
    prefix,
  })
}

export const signUpLimiter = makeRatelimit('rl:signup', Ratelimit.slidingWindow(20, '1 h'))
export const signInLimiter = makeRatelimit('rl:signin', Ratelimit.slidingWindow(10, '15 m'))
export const actionLimiter = makeRatelimit('rl:action', Ratelimit.slidingWindow(20, '1 m'))
export const searchLimiter = makeRatelimit('rl:search', Ratelimit.slidingWindow(60, '1 m'))
export const pageLimiter = makeRatelimit('rl:page', Ratelimit.slidingWindow(200, '1 m'))
export const apiLimiter = makeRatelimit('rl:api', Ratelimit.slidingWindow(60, '1 m'))
export const checkoutLimiter = makeRatelimit('rl:checkout', Ratelimit.slidingWindow(5, '1 h'))
