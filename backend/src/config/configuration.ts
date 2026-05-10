export default () => ({
  footballApiKey: process.env['FOOTBALL_API_KEY'] ?? '',
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
  appPin: process.env['APP_PIN'] ?? '',
  // Comma-separated list of host substrings that ALWAYS run in demo (locked)
  // mode. Any request whose Host header (or X-Forwarded-Host) contains one of
  // these substrings is forced into demo mode: writes are blocked, the badge
  // "Mode démo verrouillée" is shown, and PIN auth is bypassed.
  // Default covers Cloudflare quick tunnels.
  demoForcedHosts: (process.env['DEMO_FORCED_HOSTS'] ?? 'trycloudflare.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
