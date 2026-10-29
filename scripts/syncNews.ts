import type { Firestore } from "firebase-admin/firestore";
import {
  COMPETITION_CODES,
  COMPETITIONS,
  type CompetitionCode,
} from "../src/lib/competitions";
import {
  NEWS_MAX_AGE,
  newsUrl,
  validNews,
  type FootballArticle,
  type FootballNews,
} from "../src/lib/footballNews";

export function normalizeNews(
  value: unknown,
  competition: CompetitionCode,
  now: number,
  log?: (message: string) => void,
): FootballArticle[] {
  if (!value || typeof value !== "object") return [];
  const articles = (value as { articles?: unknown }).articles;
  if (!Array.isArray(articles)) {
    log?.(`Noticias ESPN ${competition}: formato sin lista articles.`);
    return [];
  }
  const rejected = { title: 0, link: 0, date: 0, expired: 0, future: 0 };
  const result = articles.slice(0, 20).flatMap((a) => {
    if (!a || typeof a !== "object") return [];
    const title = typeof a.headline === "string" ? a.headline.trim() : "";
    const url = newsUrl(a.links?.web?.href);
    const published =
      typeof a.published === "string" ? Date.parse(a.published) : NaN;
    if (!title || title.length > 240) {
      rejected.title++;
      return [];
    }
    if (!url) {
      rejected.link++;
      return [];
    }
    if (!Number.isFinite(published)) {
      rejected.date++;
      return [];
    }
    if (published > now) {
      rejected.future++;
      return [];
    }
    if (now - published > NEWS_MAX_AGE) {
      rejected.expired++;
      return [];
    }
    return [
      {
        title,
        url,
        publishedAt: new Date(published).toISOString(),
        competition,
      },
    ];
  });
  log?.(
    `Noticias ESPN ${competition}: recibidos ${articles.length}, válidos ${result.length}; descartados por título ${rejected.title}, enlace ${rejected.link}, fecha inválida ${rejected.date}, antigüedad ${rejected.expired}, fecha futura ${rejected.future}.`,
  );
  return result;
}
export async function syncNews(
  db: Firestore,
  options: {
    now?: number;
    request?: typeof fetch;
    log?: (message: string) => void;
  } = {},
) {
  const now = options.now ?? Date.now();
  const request = options.request ?? fetch;
  const log = options.log ?? console.log;
  const ref = db.doc("news/football");
  const previous = (await ref.get()).data();
  const fresh =
    validNews(previous) &&
    previous.linkPolicyVersion === 2 &&
    Date.parse(previous.fetchedAt) <= now &&
    now - Date.parse(previous.fetchedAt) < 6 * 3_600_000;
  if (fresh) return;
  const all: FootballArticle[] = [];
  // A failed/empty response never replaces the last good feed. Fixed provider URLs only.
  for (const code of COMPETITION_CODES) {
    try {
      const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${COMPETITIONS[code].espn}/news`;
      for (const suffix of ["?limit=8&lang=es&region=es", ""]) {
        const response = await request(base + suffix, {
          signal: AbortSignal.timeout(15_000),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          log(
            `Noticias ESPN ${code}: HTTP ${response.status}; se conserva la edición anterior.`,
          );
          return [403, 429].includes(response.status) ? false : undefined;
        }
        const body = await response.text();
        if (body.length > 1_000_000) throw new Error("size");
        const articles = normalizeNews(JSON.parse(body), code, now, log);
        all.push(...articles);
        if (articles.length) break;
        if (suffix)
          log(
            `Noticias ESPN ${code}: se comprueba la edición sin parámetros de idioma.`,
          );
      }
    } catch {
      log(
        "Noticias ESPN: proveedor no disponible; se conserva la edición anterior.",
      );
      return;
    }
  }
  const unique = [...new Map(all.map((a) => [a.url, a])).values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 6);
  if (!unique.length) {
    log(
      "Noticias ESPN: sin titulares recientes; se conserva la edición anterior.",
    );
    return;
  }
  const news: FootballNews = {
    version: 1,
    provider: "ESPN",
    linkPolicyVersion: 2,
    fetchedAt: new Date(now).toISOString(),
    articles: unique,
  };
  await ref.set(news);
  log(`Noticias ESPN: ${unique.length} titulares guardados en un documento.`);
}
