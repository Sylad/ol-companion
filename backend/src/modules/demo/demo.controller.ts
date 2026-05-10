import { Controller, Get } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly ctx: RequestContextService) {}

  /**
   * Returns the current demo state for this request. The frontend boots by
   * calling this endpoint to know whether it should show the "Mode démo
   * verrouillée" badge and disable write actions.
   *
   * - `forced`: the host matches DEMO_FORCED_HOSTS → locked, no escape via UI.
   * - `demoMode`: forced OR opt-in via X-Demo-Mode header.
   */
  @Get('status')
  status(): { demoMode: boolean; forced: boolean } {
    return {
      demoMode: this.ctx.isDemoMode(),
      forced: this.ctx.isForced(),
    };
  }
}
