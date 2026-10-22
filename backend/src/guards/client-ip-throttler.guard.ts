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
 *
 * L19 : une IPv6 est suivie par son préfixe /64 (un visiteur reçoit un /64
 * entier et change d'adresse à volonté) ; une IPv4 reste telle quelle.
 */
export function clientTracker(req: TrackedRequest): string {
  const raw = req.headers?.['cf-connecting-ip'];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (value && isIP(value)) return visitorKey(value);
  const fallback = req.ip ?? '';
  return isIP(fallback) ? visitorKey(fallback) : fallback;
}

/** Clé de quota d'une adresse valide : IPv4 telle quelle, IPv6 au /64. */
function visitorKey(ip: string): string {
  if (isIP(ip) === 4) return ip;
  const groups = expandIPv6(ip);
  const mapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  const prefix = groups.slice(0, 4);
  while (prefix.length && prefix[prefix.length - 1] === 0) prefix.pop();
  const head = prefix.map((g) => g.toString(16)).join(':');
  return `${head}::/64`;
}

/** Les 8 groupes de 16 bits d'une IPv6 valide (`::` et IPv4 finale compris). */
function expandIPv6(ip: string): number[] {
  let text = ip.split('%')[0];
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [left, right] = text.split('::');
  const l = left ? left.split(':') : [];
  const r = right === undefined ? [] : right ? right.split(':') : [];
  const fill =
    right === undefined ? [] : Array(8 - l.length - r.length).fill('0');
  return [...l, ...fill, ...r].map((g) => parseInt(g, 16));
}

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(clientTracker(req));
  }
}
