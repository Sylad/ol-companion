import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutPage } from './about';
import { contrast, token } from '@/test/contraste';

describe('À propos — mes autres sites', () => {
  it('pointe Eywa vers le site qui répond, pas vers un nom qui ne résout pas', () => {
    const { container } = render(<AboutPage />);
    const lien = screen.getByText('Eywa').closest('a');
    expect(lien?.getAttribute('href')).toBe('https://avatar-pandora-12q.pages.dev');
    expect(container.innerHTML).not.toContain('eywa-eywa');
  });

  // L93 — docs/qa/expectations.md nomme ce sélecteur : `header > p`, jamais `.eyebrow`.
  it('porte le surtitre dans le premier <p> du <header>, sans classe .eyebrow', () => {
    const { container } = render(<AboutPage />);
    expect(container.querySelector('.eyebrow')).toBeNull();
    expect(container.querySelector('header > p')?.textContent).toContain('À propos · OL Companion');
  });
});

// L200 — revue UX L11 : contraste (WCAG 1.4.3) et langue des passages (WCAG 3.1.2).
describe('À propos — L200', () => {
  it('R1 — le lien ChatGPT et le mot « bleu » sont en --ol-blue-fg, lisible (≥ 4,5:1) sur la carte', () => {
    render(<AboutPage />);
    const lien = screen.getByText('ChatGPT').closest('a');
    expect(lien?.className).toContain('text-ol-blue-fg');
    expect(lien?.className).not.toContain('text-ol-blue-bright');
    expect(screen.getByText('bleu').className).toContain('text-ol-blue-fg');
    expect(contrast(token('ol-blue-fg'), token('surface'))).toBeGreaterThanOrEqual(4.5);
  });

  it('R2 — le titre « Vibe coded with Claude Code » est balisé lang="en"', () => {
    render(<AboutPage />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Vibe coded with Claude Code');
    expect(h1.getAttribute('lang')).toBe('en');
  });

  it('R3 — « Made with curiosity » est balisé lang="en", sans toucher au français autour', () => {
    render(<AboutPage />);
    const en = screen.getByText('Made with curiosity');
    expect(en.getAttribute('lang')).toBe('en');
    expect(en.parentElement?.textContent).toBe("Allez l'OL · Made with curiosity · v2.0");
    expect(en.parentElement?.getAttribute('lang')).toBeNull();
  });
});

// L204 — revue UX L11 : « Notifications match » juste sous l'en-tête (elle était à 3 435 px sur 4 597 à 390 px).
describe('À propos — L204', () => {
  it('R1 — la section « Notifications match » est la première section, juste après l’en-tête', () => {
    const { container } = render(<AboutPage />);
    const racine = container.firstElementChild!;
    const enfants = Array.from(racine.children);
    expect(enfants[0].tagName).toBe('HEADER');
    expect(enfants[1].tagName).toBe('SECTION');
    expect(enfants[1].querySelector('h3')?.textContent).toBe('Notifications match');
  });

  it('R2 — la section garde ses deux textes d’explication', () => {
    render(<AboutPage />);
    const titre = screen.getByRole('heading', { name: 'Notifications match' });
    const section = titre.closest('section')!;
    expect(section.textContent).toContain('Opt-in, désactivable en un clic');
    expect(section.textContent).toContain('Aucun serveur push externe');
  });
});
