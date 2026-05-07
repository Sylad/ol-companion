import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * PIN guard for write/admin endpoints.
 * - If APP_PIN is unset → all requests pass (dev/local mode).
 * - Otherwise client must send `Authorization: Bearer <pin>`.
 */
@Injectable()
export class PinGuard implements CanActivate {
  private readonly pin: string;

  constructor() {
    this.pin = process.env['APP_PIN'] ?? '';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.pin) return true;

    const req = ctx.switchToHttp().getRequest<Request>();

    // Le flux SSE ne peut pas porter le header Authorization (EventSource standard
    // n'a pas d'API pour les headers custom). Bypass pour préserver le push live.
    if (req.url.startsWith('/api/events')) return true;

    const auth = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (token === this.pin) return true;
    throw new UnauthorizedException('PIN invalide');
  }
}
