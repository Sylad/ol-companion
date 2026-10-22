import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from '../events/events.module';
import { DemoModule } from '../demo/demo.module';
import { PlayersModule } from './players.module';
import { PlayerStatsService } from './player-stats.service';
import { SeasonResetService } from '../scheduler/season-reset.service';

describe('PlayersModule (L34)', () => {
  it('R8 — le module réel inscrit PlayerStatsService à la remise à zéro de saison', async () => {
    const onReset = jest.spyOn(SeasonResetService.prototype, 'onReset');
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventsModule,
        DemoModule,
        PlayersModule,
      ],
    }).compile();
    const svc = moduleRef.get(PlayerStatsService);
    const seasonReset = moduleRef.get(SeasonResetService, { strict: false });
    expect(onReset).toHaveBeenCalledTimes(1);

    (svc as any).cacheMatchCount = 45;
    (seasonReset as any).resetListeners.forEach((l: () => void) => l());
    expect((svc as any).cacheMatchCount).toBe(0);
    onReset.mockRestore();
  });
});
