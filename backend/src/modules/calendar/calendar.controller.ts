import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

/** L264 — `GET /api/calendar.ics`, l'adresse à laquelle un agenda s'abonne. */
@Controller()
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="ol-ligue1.ics"')
  @Header('Cache-Control', 'public, max-age=900')
  async ics(): Promise<string> {
    const body = await this.service.calendar();
    if (body === null) {
      throw new ServiceUnavailableException(
        'Calendrier indisponible : football-data.org n’a fourni aucun match.',
      );
    }
    return body;
  }
}
