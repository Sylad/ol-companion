export default () => ({
  footballApiKey: process.env['FOOTBALL_API_KEY'] ?? '',
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
});
