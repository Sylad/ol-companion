import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  demoMode: boolean;
  forced: boolean;
}

/**
 * Per-request demo-mode context, carried via AsyncLocalStorage so any service
 * deep in the call stack can check whether the current HTTP request is being
 * served in forced-demo mode (Cloudflare tunnel, public showcase, …).
 *
 * Unlike the finance-tracker variant, OL Companion is read-only by nature
 * (no user-owned data), so there's no separate `data/demo/` folder — the
 * context is purely used to short-circuit write endpoints and to expose the
 * status to the frontend.
 */
@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  runWith<T>(ctx: RequestContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  isDemoMode(): boolean {
    return this.als.getStore()?.demoMode ?? false;
  }

  isForced(): boolean {
    return this.als.getStore()?.forced ?? false;
  }
}
