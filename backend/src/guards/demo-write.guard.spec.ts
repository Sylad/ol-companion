import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DemoWriteGuard } from './demo-write.guard';
import { RequestContextService } from '../modules/demo/request-context.service';

function dummyCtx(): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({}) }) } as unknown as ExecutionContext;
}

describe('DemoWriteGuard', () => {
  let ctx: RequestContextService;
  let guard: DemoWriteGuard;

  beforeEach(() => {
    ctx = new RequestContextService();
    guard = new DemoWriteGuard(ctx);
  });

  it('allows the write when not in demo mode', () => {
    ctx.runWith({ demoMode: false, forced: false }, () => {
      expect(guard.canActivate(dummyCtx())).toBe(true);
    });
  });

  it('blocks the write when demo mode is opt-in (X-Demo-Mode header)', () => {
    ctx.runWith({ demoMode: true, forced: false }, () => {
      expect(() => guard.canActivate(dummyCtx())).toThrow(ForbiddenException);
    });
  });

  it('blocks the write when demo mode is forced by host', () => {
    ctx.runWith({ demoMode: true, forced: true }, () => {
      expect(() => guard.canActivate(dummyCtx())).toThrow(ForbiddenException);
    });
  });
});
