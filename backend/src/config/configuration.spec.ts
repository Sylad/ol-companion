import configuration from './configuration';

describe('configuration — demo mode (L14)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('DEMO_FORCED is off by default', () => {
    delete process.env['DEMO_FORCED'];
    expect(configuration().demoForcedAll).toBe(false);
  });

  it('DEMO_FORCED=true forces the whole instance (case and spaces ignored)', () => {
    process.env['DEMO_FORCED'] = ' TRUE ';
    expect(configuration().demoForcedAll).toBe(true);
  });

  it('any other DEMO_FORCED value leaves it off', () => {
    process.env['DEMO_FORCED'] = '1';
    expect(configuration().demoForcedAll).toBe(false);
  });

  it('DEMO_FORCED_HOSTS defaults to the Cloudflare tunnel domains', () => {
    delete process.env['DEMO_FORCED_HOSTS'];
    expect(configuration().demoForcedHosts).toEqual(['trycloudflare.com', 'cfargotunnel.com']);
  });
});
