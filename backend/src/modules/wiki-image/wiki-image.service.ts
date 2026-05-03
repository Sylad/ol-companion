import { Injectable } from '@nestjs/common';

export interface WikiImageResult {
  imageUrl: string | null;
  pageTitle: string | null;
  pageUrl: string | null;
}

const BASE = 'https://fr.wikipedia.org/w/api.php';
const CACHE = new Map<string, WikiImageResult>();
const HEADERS = { 'User-Agent': 'OLCompanion/2.0 (https://github.com/Sylad/ol-companion)' };

@Injectable()
export class WikiImageService {
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
      const searchData = (await searchRes.json()) as any;

      const results: any[] = searchData?.query?.search ?? [];
      for (const r of results) {
        const result = await this.fetchPageImage(r.title as string);
        if (result.imageUrl) {
          CACHE.set(key, result);
          return result;
        }
      }

      const empty: WikiImageResult = { imageUrl: null, pageTitle: null, pageUrl: null };
      CACHE.set(key, empty);
      return empty;
    } catch {
      const empty: WikiImageResult = { imageUrl: null, pageTitle: null, pageUrl: null };
      CACHE.set(key, empty);
      return empty;
    }
  }

  private async fetchPageImage(pageTitle: string): Promise<WikiImageResult> {
    const url = `${BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=1200&origin=*`;
    const res = await fetch(url, { headers: HEADERS });
    const data = (await res.json()) as any;

    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) {
      return { imageUrl: null, pageTitle: null, pageUrl: null };
    }

    const thumbnail = page?.thumbnail?.source ?? null;
    const resolvedTitle = (page?.title as string) ?? pageTitle;
    return {
      imageUrl: thumbnail,
      pageTitle: resolvedTitle,
      pageUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/ /g, '_'))}`,
    };
  }
}
