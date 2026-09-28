import type { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { isForcedDemoRequest } from './forced-demo';
import { DemoModeMiddleware } from './demo-mode.middleware';
import { RequestContextService } from './request-context.service';
import { PinGuard } from '../../guards/pin.guard';
import { DemoWriteGuard } from '../../guards/demo-write.guard';

const HOSTS = ['trycloudflare.com', 'cfargotunnel.com'];

const req = (headers: Record<string, string>, url = '/api/admin/reset-season') => {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { url, headers: lower, header: (name: string) => lower[name.toLowerCase()] };
};

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('isForcedDemoRequest (L14)', () => {
  it('forces demo when the Host matches a forced pattern', () => {
    expect(isForcedDemoRequest(req({ host: 'abc.trycloudflare.com' }), HOSTS, false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'abc.TRYCLOUDFLARE.com' }), HOSTS, false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'x.cfargotunnel.com' }), HOSTS, false)).toBe(true);
  });

  it('ignores X-Forwarded-Host: a client cannot leave forced demo by forging it', () => {
    const r = req({ host: 'abc.trycloudflare.com', 'x-forwarded-host': 'example.com' });
    expect(isForcedDemoRequest(r, HOSTS, false)).toBe(true);
  });

  it('ignores X-Forwarded-Host: a client cannot enter forced demo (PIN bypass) by forging it', () => {
    const r = req({ host: 'ol.sladoire.dev', 'x-forwarded-host': 'x.trycloudflare.com' });
    expect(isForcedDemoRequest(r, HOSTS, false)).toBe(false);
  });

  it('forces every request when the instance is forced server-side (DEMO_FORCED)', () => {
    expect(isForcedDemoRequest(req({ host: 'ol.sladoire.dev' }), HOSTS, true)).toBe(true);
    expect(isForcedDemoRequest(req({}), [], true)).toBe(true);
  });

  it('matches the exact host or a dot-preceded suffix only, never a substring', () => {
    const TUNNEL = ['trycloudflare.com'];
    expect(isForcedDemoRequest(req({ host: 'evil-trycloudflare.com' }), TUNNEL, false)).toBe(false);
    expect(isForcedDemoRequest(req({ host: 'trycloudflare.com.evil.net' }), TUNNEL, false)).toBe(false);
    expect(isForcedDemoRequest(req({ host: 'x.trycloudflare.com:443' }), TUNNEL, false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'trycloudflare.com' }), TUNNEL, false)).toBe(true);
  });

  it('normalises port, trailing dot and case on both sides', () => {
    expect(isForcedDemoRequest(req({ host: 'X.TryCloudflare.COM.' }), ['trycloudflare.com'], false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'x.trycloudflare.com.:8443' }), ['trycloudflare.com'], false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'a.trycloudflare.com' }), [' TryCloudflare.com. '], false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'mytrycloudflare.com:443' }), ['trycloudflare.com'], false)).toBe(false);
    expect(isForcedDemoRequest(req({ host: '[::1]:3002' }), ['trycloudflare.com'], false)).toBe(false);
  });

  it('accepts a pattern written with a leading dot', () => {
    expect(isForcedDemoRequest(req({ host: 'x.trycloudflare.com' }), ['.trycloudflare.com'], false)).toBe(true);
    expect(isForcedDemoRequest(req({ host: 'evil-trycloudflare.com' }), ['.trycloudflare.com'], false)).toBe(false);
  });

  it('is not forced without a Host and without the server-side flag', () => {
    expect(isForcedDemoRequest(req({}), HOSTS, false)).toBe(false);
    expect(isForcedDemoRequest(req({ host: 'x' }), ['', ' ', '.'], false)).toBe(false);
  });
});

describe('DemoModeMiddleware — forced detection (L14)', () => {
  const run = (headers: Record<string, string>, values: Record<string, unknown> = {}) => {
    const ctx = new RequestContextService();
    const mw = new DemoModeMiddleware(ctx, config({ demoForcedHosts: HOSTS, ...values }));
    let captured: { demoMode: boolean; forced: boolean } | undefined;
    mw.use(req(headers) as never, {} as never, () => {
      captured = { demoMode: ctx.isDemoMode(), forced: ctx.isForced() };
    });
    return captured!;
  };

  it('stays forced when a tunnel visitor forges X-Forwarded-Host', () => {
    expect(run({ host: 'abc.trycloudflare.com', 'x-forwarded-host': 'example.com' }))
      .toEqual({ demoMode: true, forced: true });
  });

  it('is not forced by a forged X-Forwarded-Host alone', () => {
    expect(run({ host: 'ol.sladoire.dev', 'x-forwarded-host': 'x.trycloudflare.com' }))
      .toEqual({ demoMode: false, forced: false });
  });

  it('is not forced by a look-alike host (substring)', () => {
    expect(run({ host: 'evil-trycloudflare.com' })).toEqual({ demoMode: false, forced: false });
  });

  it('honours the server-side DEMO_FORCED flag, whatever the headers', () => {
    expect(run({ host: 'ol.sladoire.dev', 'x-forwarded-host': 'example.com' }, { demoForcedAll: true }))
      .toEqual({ demoMode: true, forced: true });
  });
});

describe('PinGuard — forced demo bypass (L14)', () => {
  const ctx = (r: unknown): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => r }) }) as unknown as ExecutionContext;
  const guard = (values: Record<string, unknown> = {}) =>
    new PinGuard(config({ appPin: '1234', demoForcedHosts: HOSTS, ...values }));

  it('does not bypass the PIN on a forged X-Forwarded-Host', () => {
    const r = req({ host: 'ol.sladoire.dev', 'x-forwarded-host': 'x.trycloudflare.com' });
    expect(() => guard().canActivate(ctx(r))).toThrow(UnauthorizedException);
  });

  it('does not bypass the PIN on a look-alike host (substring)', () => {
    const r = req({ host: 'trycloudflare.com.evil.net' });
    expect(() => guard().canActivate(ctx(r))).toThrow(UnauthorizedException);
  });

  it('bypasses the PIN when the Host is a forced demo host', () => {
    expect(guard().canActivate(ctx(req({ host: 'abc.trycloudflare.com' })))).toBe(true);
  });

  it('bypasses the PIN when the instance is forced server-side', () => {
    expect(guard({ demoForcedAll: true }).canActivate(ctx(req({ host: 'ol.sladoire.dev' })))).toBe(true);
  });

  it('still accepts the right PIN on a regular host', () => {
    const r = req({ host: 'ol.sladoire.dev', authorization: 'Bearer 1234' });
    expect(guard().canActivate(ctx(r))).toBe(true);
  });
});

describe('DemoWriteGuard — forced demo stays read-only whatever the headers (L14)', () => {
  it('rejects writes on a forced host even with a forged X-Forwarded-Host', () => {
    const rc = new RequestContextService();
    const mw = new DemoModeMiddleware(rc, config({ demoForcedHosts: HOSTS }));
    const writeGuard = new DemoWriteGuard(rc);
    let thrown: unknown;
    mw.use(req({ host: 'abc.trycloudflare.com', 'x-forwarded-host': 'example.com' }) as never, {} as never, () => {
      try { writeGuard.canActivate({} as ExecutionContext); } catch (e) { thrown = e; }
    });
    expect(thrown).toBeInstanceOf(ForbiddenException);
  });
});
