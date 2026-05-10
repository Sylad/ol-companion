import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * Detects whether the current request is being served from a "forced demo"
 * host (e.g. a Cloudflare quick tunnel) by comparing the Host header (or the
 * upstream X-Forwarded-Host) against a configurable list of substrings.
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
    const hostHeader = (
      (req.header('x-forwarded-host') ?? req.header('host') ?? '') as string
    ).toLowerCase();

    const forced = forcedHosts.some(
      (pattern) => pattern && hostHeader.includes(pattern.toLowerCase()),
    );

    // Optional opt-in flag for local dev/QA: clients can also send
    // X-Demo-Mode: true to manually flip the flag without a tunnel.
    const headerOptIn = req.header('X-Demo-Mode') === 'true';

    const demoMode = forced || headerOptIn;
    this.ctx.runWith({ demoMode, forced }, () => next());
  }
}
