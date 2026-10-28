import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoBanner } from '@/components/demo-banner';

vi.mock('@/hooks/use-demo-status', () => ({ useDemoStatus: () => ({ data: { forced: true } }) }));

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--bandeau-demo-h');
});

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Ligne collante de la pastille du direct (L64)', () => {
  it('R5 — sous 1024 px --ligne-direct-h vaut la hauteur de la ligne (36 px = h-9), 0 au bureau', () => {
    expect(css).toMatch(/:root\s*\{\s*--ligne-direct-h:\s*0px;?\s*\}/);
    expect(css).toMatch(/@media \(max-width: 1023px\)\s*\{\s*:root\s*\{\s*--ligne-direct-h:\s*36px/);
  });

  it('R6 — le scroll-padding-top compte la ligne collante et le bandeau démo (WCAG 2.4.11)', () => {
    expect(css).toMatch(/scroll-padding-top:\s*calc\(var\(--barre-filtres-h,\s*124px\)\s*\+\s*var\(--ligne-direct-h\)\s*\+\s*var\(--bandeau-demo-h,\s*0px\)\)/);
  });

  it('R7 — le bandeau démo publie sa hauteur dans --bandeau-demo-h et la retire en partant', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 28.4 } as DOMRect);
    class Obs { observe() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', Obs);
    const { unmount } = render(<QueryClientProvider client={new QueryClient()}><DemoBanner /></QueryClientProvider>);
    expect(document.documentElement.style.getPropertyValue('--bandeau-demo-h')).toBe('29px');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--bandeau-demo-h')).toBe('');
    rect.mockRestore();
    vi.unstubAllGlobals();
  });
});
