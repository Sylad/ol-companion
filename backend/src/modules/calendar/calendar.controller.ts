import { Controller, Get, Header, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

/** Le calendrier servi : gardé 15 min par les agendas et les caches. */
export const CALENDAR_CACHE_CONTROL = 'public, max-age=900';

/**
 * L268 — une erreur n'est jamais déclarée cachable : un 503 gardé 15 min par
 * Cloudflare ou un agenda prolongerait la panne après le retour des données.
 */
export const CALENDAR_ERROR_CACHE_CONTROL = 'no-store';

/** L264 — `GET /api/calendar.ics`, l'adresse à laquelle un agenda s'abonne. */
@Controller()
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="ol-ligue1.ics"')
  async ics(@Res({ passthrough: true }) res: Response): Promise<string> {
    // Posé ici, pas par `@Header` : Nest pose les `@Header` avant le handler,
    // et le 503 en héritait (revue L264, note 6).
    const body = await this.service.calendar();
    if (body === null) {
      res.setHeader('Cache-Control', CALENDAR_ERROR_CACHE_CONTROL);
      throw new ServiceUnavailableException(
        'Calendrier indisponible : football-data.org n’a fourni aucun match.',
      );
    }
    res.setHeader('Cache-Control', CALENDAR_CACHE_CONTROL);
    return body;
  }
}
