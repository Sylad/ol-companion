import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { FixturesService } from '../fixtures/fixtures.service';
import {
  LIGUE1,
  buildCalendar,
  eventBody,
  reviseEvents,
  type Revisions,
} from './match-calendar';

/**
 * L264 — sert le calendrier `.ics` des matchs de Ligue 1 de l'OL.
 *
 * Données : `FixturesService` (football-data.org seul, jamais 365scores, cf.
 * `match-calendar.ts`). Les révisions de chaque événement (SEQUENCE, date de
 * modification) sont gardées dans `data/calendar-revisions.json` pour qu'un
 * agenda abonné mette à jour un match au lieu de le dupliquer, et que le flux
 * reste identique d'une lecture à l'autre tant que rien ne change.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly revisionsFile = path.resolve(process.cwd(), 'data', 'calendar-revisions.json');

  constructor(private readonly fixtures: FixturesService) {}

  /**
   * Le calendrier, ou `null` quand football-data n'a fourni aucun match (pas
   * de clé, aucun cache) : un calendrier vide ferait effacer ses matchs à
   * l'agenda abonné, on répond une erreur et il garde sa dernière copie.
   */
  async calendar(now: Date = new Date()): Promise<string | null> {
    const matches = (await this.fixtures.getFixtures())
      .filter((m) => m.competition === LIGUE1)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (matches.length === 0) return null;

    const bodies = matches.map(eventBody);
    const { revisions, changed } = reviseEvents(this.readRevisions(), bodies, now);
    if (changed) this.writeRevisions(revisions);
    return buildCalendar(bodies, revisions);
  }

  private readRevisions(): Revisions {
    if (!fs.existsSync(this.revisionsFile)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.revisionsFile, 'utf-8')) as Revisions;
    } catch (err: unknown) {
      this.logger.warn(`Révisions du calendrier illisibles (${this.revisionsFile}) : ${(err as Error)?.message ?? err}`);
      return {};
    }
  }

  private writeRevisions(revisions: Revisions): void {
    try {
      atomicWriteJsonSync(this.revisionsFile, revisions);
    } catch (err: unknown) {
      this.logger.error(`Écriture des révisions du calendrier impossible : ${(err as Error)?.message ?? err}`);
    }
  }
}
