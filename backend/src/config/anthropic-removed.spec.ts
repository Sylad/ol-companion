import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import configuration from './configuration';

/**
 * L17 — l'app n'appelle jamais Claude : l'outillage Anthropic inutilisé
 * (SDK, clé de configuration, variable d'environnement) est retiré.
 */
describe('outillage Anthropic retiré (L17)', () => {
  const backendRoot = join(__dirname, '..', '..');

  it("la configuration n'expose plus de clé Anthropic", () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    try {
      expect(Object.keys(configuration())).not.toContain('anthropicApiKey');
    } finally {
      delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('le SDK Anthropic ne figure plus dans les dépendances', () => {
    const pkg = JSON.parse(
      readFileSync(join(backendRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => d.startsWith('@anthropic-ai/'))).toEqual([]);
  });

  it("l'exemple d'environnement ne demande plus ANTHROPIC_API_KEY", () => {
    const envExample = readFileSync(join(backendRoot, '.env.example'), 'utf8');
    expect(envExample).not.toMatch(/ANTHROPIC/i);
  });
});
