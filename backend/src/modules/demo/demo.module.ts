import { Global, Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoModeMiddleware } from './demo-mode.middleware';
import { RequestContextService } from './request-context.service';

/**
 * Demo-mode plumbing for OL Companion.
 *
 * Pattern: forced demo mode based on the Host header only — never
 * X-Forwarded-Host (Cloudflare quick tunnel, public showcase domain, …) — or
 * on DEMO_FORCED=true for the whole instance; single decision in
 * forced-demo.ts (L14). When forced=true:
 *   - PinGuard is bypassed (same isForcedDemoRequest decision).
 *   - Write endpoints throw 403 (see DemoWriteGuard).
 *   - Frontend shows a "Mode démo verrouillée" badge.
 *
 * Activation: set DEMO_FORCED_HOSTS="trycloudflare.com,demo.example.com" in
 * the backend env, restart, then expose via `cloudflared tunnel --url
 * http://localhost:4202`.
 */
@Global()
@Module({
  controllers: [DemoController],
  providers: [RequestContextService, DemoModeMiddleware],
  exports: [RequestContextService, DemoModeMiddleware],
})
export class DemoModule {}
