import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMatchInsightLoader,
  MATCH_INSIGHT_TTL,
} from "../src/lib/matchInsightCache";
import {
  insightFitsMatch,
  matchExternalLinks,
  validMatchInsight,
  type MatchInsight,
} from "../src/lib/matchInsightsData";
import type { Match } from "../src/lib/domain";

const fixture: Match = {
  id: "123",
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "round",
  matchday: 3,
  stage: "REGULAR_SEASON",
  utcDate: "2026-10-28T20:00:00Z",
  status: "TIMED",
  home: "Real Madrid",
  away: "FC Barcelona",
  homeScore: null,
  awayScore: null,
};
const detail = (id = fixture.id): MatchInsight => ({
  version: 1,
  matchId: id,
  competition: "PD",
  kickoff: fixture.utcDate,
  provider: "ESPN",
  eventId: "12345",
  fetchedAt: "2026-10-28T19:00:00Z",
  goals: [],
  lineups: [],
  statistics: [],
});
const storage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    items,
  };
};
afterEach(() => vi.useRealTimers());

describe("Detalles públicos bajo demanda", () => {
  it("no consulta al crearse; agrupa aperturas concurrentes y restaura la caché tras recargar", async () => {
    const store = storage(),
      fetch = vi.fn(async () => detail());
    const load = createMatchInsightLoader("project", () => store, fetch);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      await Promise.all([load(fixture), load(fixture), load(fixture)]),
    ).toEqual([detail(), detail(), detail()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const reloaded = createMatchInsightLoader("project", () => store, fetch);
    expect(await reloaded(fixture)).toEqual(detail());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cachea también ausencias y vuelve a consultar solo tras caducar", async () => {
    vi.useFakeTimers();
    const store = storage(),
      fetch = vi.fn(async () => null);
    const load = createMatchInsightLoader("project", () => store, fetch);
    await load(fixture);
    await load(fixture);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MATCH_INSIGHT_TTL + 1);
    await load(fixture);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rechaza datos de otro partido, competición u horario reprogramado", async () => {
    const store = storage();
    const fetch = vi.fn(async () => detail());
    const load = createMatchInsightLoader("project", () => store, fetch);
    await load(fixture);
    expect(
      await load({ ...fixture, utcDate: "2026-10-29T20:00:00Z" }),
    ).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(insightFitsMatch({ ...detail(), competition: "CL" }, fixture)).toBe(
      false,
    );
    expect(await load({ ...fixture, id: "456" })).toBeNull();
  });
  it("permite reintentar un fallo y sigue funcionando si el almacenamiento está bloqueado", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(detail());
    const load = createMatchInsightLoader(
      "project",
      () => {
        throw new Error("storage blocked");
      },
      fetch,
    );
    await expect(load(fixture)).rejects.toThrow("offline");
    expect(await load(fixture)).toEqual(detail());
    await load(fixture);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("limita a doce fichas públicas y mantiene separados proyectos y demo", async () => {
    const store = storage(),
      fetch = vi.fn(async (id: string) => detail(id));
    const load = createMatchInsightLoader("project", () => store, fetch);
    for (let i = 0; i < 20; i++) await load({ ...fixture, id: String(i) });
    const raw = store.getItem("galacticbet:match-insights:v1:project")!;
    expect(JSON.parse(raw)).toHaveLength(12);
    expect(raw.length).toBeLessThan(180_000);
    expect(await load({ ...fixture, id: "demo-0" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(20);
    await createMatchInsightLoader(
      "other",
      () => store,
      fetch,
    )({ ...fixture, id: "19" });
    expect(fetch).toHaveBeenCalledTimes(21);
  });
  it("descarta cachés corruptas y no almacena respuestas malformadas", async () => {
    const store = storage();
    store.setItem("galacticbet:match-insights:v1:project", "{broken");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ...detail(),
        lineups: [{ side: "home", players: [{}] }],
      })
      .mockResolvedValue(detail());
    const load = createMatchInsightLoader("project", () => store, fetch);
    await expect(load(fixture)).rejects.toThrow("no compatible");
    expect(await load(fixture)).toEqual(detail());
  });
  it("valida alineaciones, goles y estadísticas sin inventar campos ausentes", () => {
    expect(validMatchInsight(detail())).toBe(true);
    expect(
      validMatchInsight({
        ...detail(),
        goals: [
          { minute: "90+3'", scorer: "Jugador", side: "home", kind: "penalty" },
        ],
      }),
    ).toBe(true);
    for (const patch of [
      { eventId: "javascript:alert(1)" },
      { attendance: -1 },
      { lineups: [{ side: "other", players: [] }] },
      { statistics: [{ label: "Posesión", home: 50, away: 50 }] },
      {
        goals: [
          { minute: "20", scorer: "Jugador", side: "home", kind: "shootout" },
        ],
      },
    ])
      expect(validMatchInsight({ ...detail(), ...patch })).toBe(false);
  });
  it("construye enlaces HTTPS de consulta con fecha y país, sin URLs del proveedor sin validar", () => {
    const links = matchExternalLinks(fixture, detail());
    const tv = new URL(links.television);
    expect(tv.origin).toBe("https://www.google.com");
    expect(tv.searchParams.get("q")).toContain("España TV emisión oficial");
    expect(links.source).toBe(
      "https://www.espn.com/soccer/match/_/gameId/12345",
    );
    expect(
      matchExternalLinks(fixture, { ...detail(), eventId: "//evil.example" })
        .source,
    ).toBeNull();
  });
});
