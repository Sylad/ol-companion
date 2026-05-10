import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContextService } from '../modules/demo/request-context.service';

/**
 * Blocks the request with HTTP 403 when the current request is running in
 * demo mode (forced by host or opt-in via X-Demo-Mode). Apply on every
 * write/admin endpoint that mutates persistent state.
 *
 * Read endpoints stay open in demo mode — the showcase has to remain useful.
 */
@Injectable()
export class DemoWriteGuard implements CanActivate {
  constructor(private readonly ctx: RequestContextService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.ctx.isDemoMode()) {
      throw new ForbiddenException('Écriture désactivée en mode démo.');
    }
    return true;
  }
}
