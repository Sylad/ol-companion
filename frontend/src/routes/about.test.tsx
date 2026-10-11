import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutPage } from './about';

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
