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
});
