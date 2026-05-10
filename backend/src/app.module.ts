import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DemoModule } from './modules/demo/demo.module';
import { DemoModeMiddleware } from './modules/demo/demo-mode.middleware';
import { HealthModule } from './modules/health/health.module';
import { ClaudeUsageModule } from './modules/claude-usage/claude-usage.module';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { SeasonMatchesModule } from './modules/season-matches/season-matches.module';
import { StandingsModule } from './modules/standings/standings.module';
import { NewsModule } from './modules/news/news.module';
import { CupsModule } from './modules/cups/cups.module';
import { EventsModule } from './modules/events/events.module';
import { WikiImageModule } from './modules/wiki-image/wiki-image.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { LineupModule } from './modules/lineup/lineup.module';
import { LiveMatchModule } from './modules/live-match/live-match.module';
import { PlayersModule } from './modules/players/players.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    ScheduleModule.forRoot(),
    // Rate limiting global. Audit a flagué le risque de hammering sur
    // /api/wiki-image et /api/standings/news (exposés via tunnel démo
    // Cloudflare). Bucket court (10/s) pour absorber les bursts UI, bucket
    // long (60/min) pour limiter les abus de tiers extérieurs (365scores
    // pourrait nous bannir si on relaie trop d'IPs publiques).
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60_000, limit: 60 },
    ]),
    DemoModule,
    SchedulerModule,
    EventsModule,
    ClaudeUsageModule,
    HealthModule,
    FixturesModule,
    SeasonMatchesModule,
    StandingsModule,
    NewsModule,
    CupsModule,
    WikiImageModule,
    ChannelsModule,
    LineupModule,
    LiveMatchModule,
    PlayersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply DemoModeMiddleware on EVERYTHING (including /api/demo/*) so the
    // forced-by-host detection populates the ALS context before the demo
    // status endpoint reads it.
    consumer
      .apply(DemoModeMiddleware)
      .exclude({ path: 'health', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}
