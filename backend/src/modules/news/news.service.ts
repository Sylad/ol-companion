import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
  image?: string;
  category?: string;
}

const RSS_SOURCES = [
  {
    url: 'https://www.olympique-et-lyonnais.com/feed',
    source: 'Olympique et Lyonnais',
    filterFn: (_: string) => true,
  },
  {
    url: 'https://news.google.com/rss/search?q=%22Olympique+Lyonnais%22+OR+%22OL+Lyon%22&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News',
    filterFn: (_: string) => true,
  },
  {
    url: 'https://www.lequipe.fr/rss/actu_rss_Foot.xml',
    source: "L'Équipe",
    filterFn: (title: string) => /\bOL\b|Lyon/i.test(title),
  },
];

const CACHE_TTL_MS = 900_000; // 15 minutes

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'news-cache.json');

  onModuleInit() {
    this.getNews({ force: true }).catch((err) =>
      this.logger.warn(`Initial news refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */30 * * * *', { name: 'news-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getNews({ force: true }).catch((err) =>
      this.logger.warn(`Periodic news refresh failed: ${(err as Error).message}`),
    );
  }

  async getNews(opts: { force?: boolean } = {}): Promise<NewsItem[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    const allItems: NewsItem[] = [];

    // Les 3 flux sont indépendants : en parallèle, la latence = le plus lent
    // (séquentiel = jusqu'à 24 s avec les timeouts 8 s). Review 2026-08-14.
    const fetched = await Promise.allSettled(RSS_SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'OL-Companion/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return this.parseRss(xml, source.source).filter(i => source.filterFn(i.title));
    }));
    fetched.forEach((r, i) => {
      if (r.status === 'fulfilled') allItems.push(...r.value);
      else this.logger.warn(`RSS ${RSS_SOURCES[i].source} indisponible: ${(r.reason as Error).message}`);
    });

    const sorted = allItems
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    if (sorted.length > 0) {
      this.writeCache(sorted);
    }
    return sorted;
  }

  private parseRss(xml: string, source: string): NewsItem[] {
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = this.decode(this.extractTag(block, 'title'));
      const link = this.extractTag(block, 'link') || this.extractTag(block, 'guid');
      const pubDate = this.extractTag(block, 'pubDate');
      const rawDescription = this.extractTag(block, 'description');
      // Google News double-encodes HTML (&lt;a&gt;...). Decode first, strip tags,
      // decode again to flatten any residual entities, then trim and clip.
      const description = this.decode(
        this.decode(rawDescription).replace(/<[^>]+>/g, ''),
      ).trim().slice(0, 240);
      const category = this.decode(this.extractTag(block, 'category'));
      const image = this.extractImage(block) || this.extractImage(rawDescription);
      if (title && link) {
        items.push({ title, link, pubDate, source, description, image, category });
      }
    }
    return items;
  }

  private extractImage(xml: string): string | undefined {
    const enc = xml.match(/<enclosure[^>]*url=["']([^"']+\.(?:jpe?g|png|webp|gif))["']/i);
    if (enc) return enc[1];
    const media = xml.match(/<media:(?:thumbnail|content)[^>]*url=["']([^"']+)["']/i);
    if (media) return media[1];
    const img = xml.match(/<img[^>]*src=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i);
    if (img) return img[1];
    return undefined;
  }

  private decode(s: string): string {
    return s
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
  }

  private extractTag(xml: string, tag: string): string {
    const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
    return m ? m[1].trim() : '';
  }

  private readCache(): NewsItem[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS && data?.length > 0) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read news cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private writeCache(data: NewsItem[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data });
  }
}
