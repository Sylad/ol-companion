import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';
import { isForcedDemoRequest } from './forced-demo';

/**
 * Detects whether the current request is being served from a "forced demo"
 * host (e.g. a Cloudflare quick tunnel) by comparing the Host header — never
 * X-Forwarded-Host, which the client controls — against a configurable list
 * of host names (exact match or dot-preceded suffix, never a substring), or
 * whether the whole instance is forced (DEMO_FORCED=true).
 * See forced-demo.ts (L14).
 *
 * When forced=true, the request runs with demoMode=true → write endpoints
 * are short-circuited and the PIN guard lets the request through.
 */
@Injectable()
export class DemoModeMiddleware implements NestMiddleware {
  constructor(
    private readonly ctx: RequestContextService,
    private readonly config: ConfigService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const forcedHosts = this.config.get<string[]>('demoForcedHosts') ?? [];
    const forcedAll = this.config.get<boolean>('demoForcedAll') ?? false;
    const forced = isForcedDemoRequest(req, forcedHosts, forcedAll);

    // Optional opt-in flag for local dev/QA: clients can also send
    // X-Demo-Mode: true to manually flip the flag without a tunnel.
    const headerOptIn = req.header('X-Demo-Mode') === 'true';

    const demoMode = forced || headerOptIn;
    this.ctx.runWith({ demoMode, forced }, () => next());
  }
}
