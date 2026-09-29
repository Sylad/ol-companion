import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';

interface TrackedRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Identifiant du visiteur pour la limite de débit (L16).
 *
 * En prod la chaîne est Cloudflare tunnel → nginx du frontend → backend :
 * `req.ip` y vaut l'IP du nginx pour tout le monde. L'IP réelle arrive dans
 * `CF-Connecting-IP`, posé par Cloudflare puis recopié par le nginx avec
 * `proxy_set_header` (qui remplace toute valeur envoyée par le client).
 *
 * `trust proxy` n'est volontairement PAS activé : X-Forwarded-For est
 * forgeable. Sans en-tête exploitable (dev local), repli sur `req.ip`.
 */
export function clientTracker(req: TrackedRequest): string {
  const raw = req.headers?.['cf-connecting-ip'];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (value && isIP(value)) return value;
  return req.ip ?? '';
}

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(clientTracker(req));
  }
}
