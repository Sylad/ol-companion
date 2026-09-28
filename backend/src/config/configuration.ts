export default () => ({
  footballApiKey: process.env['FOOTBALL_API_KEY'] ?? '',
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
  appPin: process.env['APP_PIN'] ?? '',
  // DEMO_FORCED=true : l'instance ENTIÈRE est verrouillée en démo, sans
  // dépendre d'aucun en-tête HTTP (cf. modules/demo/forced-demo.ts, L14).
  // Off par défaut.
  demoForcedAll: (process.env['DEMO_FORCED'] ?? '').trim().toLowerCase() === 'true',
  // Comma-separated list of host names that ALWAYS run in demo (locked)
  // mode. Any request whose Host header (never X-Forwarded-Host, which the
  // client controls) is one of these names or a subdomain of one (exact or
  // dot-preceded suffix match, port and trailing dot ignored, never a mere
  // substring — L14) is forced into demo mode: writes are blocked, the badge
  // "Mode démo verrouillée" is shown, and PIN auth is bypassed.
  // Default covers Cloudflare quick tunnels.
  demoForcedHosts: (process.env['DEMO_FORCED_HOSTS'] ?? 'trycloudflare.com,cfargotunnel.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
