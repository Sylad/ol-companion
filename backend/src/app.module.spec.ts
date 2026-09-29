import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';

/**
 * L15 (2026-09-29, décision de Sylvain, comme warhammer40k L22) : le suivi
 * d'usage / solde Claude (claude-shared.json, /api/claude/usage,
 * /api/claude/balance) est retiré. Aucun contrôleur ne doit plus être monté
 * sous /api/claude.
 */
function controllerPaths(mod: unknown, seen = new Set<unknown>()): string[] {
  if (!mod || seen.has(mod)) return [];
  seen.add(mod);
  const target = (mod as { module?: unknown }).module ?? mod;
  const controllers = (Reflect.getMetadata('controllers', target) ??
    []) as object[];
  const imports = (Reflect.getMetadata('imports', target) ?? []) as unknown[];
  const own = controllers.map((c) =>
    String((Reflect.getMetadata(PATH_METADATA, c) as string | undefined) ?? ''),
  );
  return [...own, ...imports.flatMap((m) => controllerPaths(m, seen))];
}

describe('AppModule — suivi d’usage Claude retiré (L15)', () => {
  it('monte bien des contrôleurs (garde-fou du test lui-même)', () => {
    expect(controllerPaths(AppModule)).toContain('fixtures');
  });

  it('ne monte plus aucun contrôleur sous /api/claude (usage, balance…)', () => {
    const paths = controllerPaths(AppModule).map((p) => p.replace(/^\/+/, ''));
    expect(
      paths.filter((p) => p === 'claude' || p.startsWith('claude/')),
    ).toEqual([]);
  });
});
