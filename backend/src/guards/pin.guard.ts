import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * PIN guard for write/admin endpoints.
 * - If APP_PIN is unset → all requests pass (dev/local mode), warning logged.
 * - In production (NODE_ENV=production) without APP_PIN → boot refusé sauf
 *   si ALLOW_NO_PIN=true (opt-in explicite).
 * - Otherwise client must send `Authorization: Bearer <pin>`.
 * - On a forced-demo host (DEMO_FORCED_HOSTS) the guard is bypassed: the
 *   visitor is locked into read-only demo data anyway, so requiring a PIN
 *   would only block them from seeing the showcase. Writes are still
 *   prevented by `DemoWriteGuard`.
 */
@Injectable()
export class PinGuard implements CanActivate {
  private readonly logger = new Logger(PinGuard.name);
  private readonly pin: string;
  private readonly forcedHosts: string[];

  constructor(config: ConfigService) {
    this.pin = config.get<string>('appPin') ?? '';
    this.forcedHosts = config.get<string[]>('demoForcedHosts') ?? [];

    if (!this.pin) {
      const allowNoPin = (config.get<string>('allowNoPin') ?? process.env.ALLOW_NO_PIN) === 'true';
      const isProd = (config.get<string>('nodeEnv') ?? process.env.NODE_ENV) === 'production';
      if (isProd && !allowNoPin) {
        throw new Error(
          'APP_PIN is empty in production. Set APP_PIN, or pass ALLOW_NO_PIN=true to opt into the unprotected mode explicitly.',
        );
      }
      this.logger.warn(
        '⚠️  APP_PIN is empty — ALL WRITE ENDPOINTS ARE UNPROTECTED. '
        + 'Set APP_PIN env var to enable PIN guard, or set ALLOW_NO_PIN=true to silence this warning.',
      );
    }
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();

    // Le flux SSE ne peut pas porter le header Authorization (EventSource standard
    // n'a pas d'API pour les headers custom). Bypass pour préserver le push live.
    if (req.url.startsWith('/api/events')) return true;

    // Bypass entirely on forced-demo hosts (Cloudflare quick tunnels, etc.).
    const hostHeader = (
      (req.headers['x-forwarded-host'] as string | undefined) ??
      (req.headers.host as string | undefined) ??
      ''
    ).toLowerCase();
    if (this.forcedHosts.some((p) => p && hostHeader.includes(p.toLowerCase()))) {
      return true;
    }

    if (!this.pin) return true;

    const auth = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    // timingSafeEqual prévient les attaques timing (théorique en local mais
    // gratuit). Buffers doivent avoir la même longueur sinon throw → on
    // pad/skip le comparison si tailles différentes (= échec direct).
    if (token.length !== this.pin.length) {
      throw new UnauthorizedException('PIN invalide');
    }
    const ok = timingSafeEqual(Buffer.from(token), Buffer.from(this.pin));
    if (ok) return true;
    throw new UnauthorizedException('PIN invalide');
  }
}
