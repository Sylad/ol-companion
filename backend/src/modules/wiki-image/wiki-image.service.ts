import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { parseExternal } from '../../common/zod-validation.pipe';

export interface WikiImageResult {
  imageUrl: string | null;
  pageTitle: string | null;
  pageUrl: string | null;
}

const BASE = 'https://fr.wikipedia.org/w/api.php';
const CACHE = new Map<string, WikiImageResult>();
const HEADERS = { 'User-Agent': 'OLCompanion/2.0 (https://github.com/Sylad/ol-companion)' };

const PageSchema = z.object({
  title: z.string().optional(),
  missing: z.string().optional(),
  thumbnail: z.object({ source: z.string() }).optional(),
});

const PageImageResponseSchema = z.object({
  query: z.object({ pages: z.record(z.string(), PageSchema).optional() }).optional(),
});

const SearchResponseSchema = z.object({
  query: z
    .object({ search: z.array(z.object({ title: z.string() })).optional() })
    .optional(),
});

@Injectable()
export class WikiImageService {
  private readonly logger = new Logger(WikiImageService.name);

  async getImage(query: string): Promise<WikiImageResult> {
    const key = query.toLowerCase().trim();
    if (CACHE.has(key)) return CACHE.get(key)!;

    try {
      const direct = await this.fetchPageImage(query);
      if (direct.imageUrl) {
        CACHE.set(key, direct);
        return direct;
      }

      const searchUrl = `${BASE}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, { headers: HEADERS });
      const searchData = parseExternal(SearchResponseSchema, await searchRes.json(), 'wiki search');

      const results = searchData.query?.search ?? [];
      for (const r of results) {
        const result = await this.fetchPageImage(r.title);
        if (result.imageUrl) {
          CACHE.set(key, result);
          return result;
        }
      }

      const empty: WikiImageResult = { imageUrl: null, pageTitle: null, pageUrl: null };
      CACHE.set(key, empty);
      return empty;
    } catch (err: unknown) {
      this.logger.warn(`Wiki image lookup failed for "${query}": ${(err as Error)?.message ?? err}`);
      const empty: WikiImageResult = { imageUrl: null, pageTitle: null, pageUrl: null };
      CACHE.set(key, empty);
      return empty;
    }
  }

  private async fetchPageImage(pageTitle: string): Promise<WikiImageResult> {
    const url = `${BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=1200&origin=*`;
    const res = await fetch(url, { headers: HEADERS });
    const data = parseExternal(PageImageResponseSchema, await res.json(), 'wiki pageimages');

    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) {
      return { imageUrl: null, pageTitle: null, pageUrl: null };
    }

    const thumbnail = page.thumbnail?.source ?? null;
    const resolvedTitle = page.title ?? pageTitle;
    return {
      imageUrl: thumbnail,
      pageTitle: resolvedTitle,
      pageUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/ /g, '_'))}`,
    };
  }
}
