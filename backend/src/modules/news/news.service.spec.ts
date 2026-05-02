import { NewsService } from './news.service';

describe('NewsService.parseRss (description decoding)', () => {
  let service: NewsService;
  beforeEach(() => { service = new NewsService(); });

  // Use bracket access to call private method in tests.
  const parseRss = (xml: string) => (service as any).parseRss(xml, 'TestSource');

  it('keeps clean text descriptions intact', () => {
    const xml = `<rss><channel><item>
      <title>Article 1</title>
      <link>https://x/1</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description>Texte simple sans HTML.</description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0].description).toBe('Texte simple sans HTML.');
  });

  it('strips raw HTML from description (L\'Equipe / standard RSS)', () => {
    const xml = `<rss><channel><item>
      <title>Article 2</title>
      <link>https://x/2</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Lyon <strong>gagne</strong> face à Marseille</p>]]></description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0].description).toBe('Lyon gagne face à Marseille');
  });

  it('strips double-encoded HTML from Google News description', () => {
    const xml = `<rss><channel><item>
      <title>Article 3</title>
      <link>https://x/3</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description>&lt;a href=&quot;https://news.google.com/x&quot;&gt;OL : Fonseca avant le derby&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font&gt;Le Progres&lt;/font&gt;</description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    // No remaining <a> or <font> markup; entities fully decoded.
    expect(items[0].description).not.toMatch(/<\/?[a-z]+/i);
    expect(items[0].description).not.toMatch(/&lt;|&gt;|&quot;|&amp;/);
    expect(items[0].description).toContain('OL : Fonseca avant le derby');
    expect(items[0].description).toContain('Le Progres');
  });
});
