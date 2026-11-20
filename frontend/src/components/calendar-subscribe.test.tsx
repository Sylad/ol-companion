import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarSubscribe, calendarUrls } from './calendar-subscribe';

/** L264 — « S'abonner » sur /fixtures : adresses, clavier, périmètre et attribution. */

describe('calendarUrls', () => {
  it('https stable, webcal pour Apple/Outlook, cid webcal pour Google', () => {
    const u = calendarUrls('https://ol.sladoire.dev');
    expect(u.https).toBe('https://ol.sladoire.dev/api/calendar.ics');
    expect(u.webcal).toBe('webcal://ol.sladoire.dev/api/calendar.ics');
    expect(u.google).toBe(
      'https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fol.sladoire.dev%2Fapi%2Fcalendar.ics',
    );
  });
});

describe('CalendarSubscribe', () => {
  it('panneau fermé au départ, ouvert au clavier (Entrée), refermé par Échap avec le focus rendu au bouton', async () => {
    const user = userEvent.setup();
    render(<CalendarSubscribe />);
    const toggle = screen.getByRole('button', { name: /S’abonner/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('panneau-abonnement')).not.toBeVisible();

    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('panneau-abonnement')).toBeVisible();

    await user.tab();
    expect(screen.getByTestId('abonnement-webcal')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('dit le périmètre (Ligue 1 seulement, coupes absentes) et la source football-data', () => {
    render(<CalendarSubscribe />);
    fireEvent.click(screen.getByTestId('abonnement-calendrier'));
    expect(screen.getByTestId('abonnement-perimetre')).toHaveTextContent(
      /Coupe de France, Ligue Europa et Ligue des champions n’y sont pas/,
    );
    expect(screen.getByTestId('attribution-football-data')).toHaveTextContent(
      'Football data provided by the Football-Data.org API',
    );
  });

  it('liens d’abonnement et adresse à copier vers /api/calendar.ics', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CalendarSubscribe />);
    fireEvent.click(screen.getByTestId('abonnement-calendrier'));
    const origin = window.location.origin;
    expect(screen.getByTestId('abonnement-webcal').getAttribute('href')).toMatch(/^webcal:\/\/.*\/api\/calendar\.ics$/);
    expect(screen.getByTestId('abonnement-google').getAttribute('href')).toContain('calendar.google.com');
    expect(screen.getByTestId('abonnement-adresse')).toHaveValue(`${origin}/api/calendar.ics`);
    fireEvent.click(screen.getByTestId('abonnement-copier'));
    expect(await screen.findByText('Adresse copiée.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${origin}/api/calendar.ics`);
  });
});
