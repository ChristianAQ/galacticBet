import { describe, expect, it } from "vitest";
import { availableMatchTabs } from "../src/lib/matchDetailTabs";
import type { Match } from "../src/lib/domain";
import type { MatchInsight } from "../src/lib/matchInsightsData";
const now = Date.parse("2026-10-28T10:00:00Z");
const match: Match = {
  id: "1",
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "r1",
  matchday: 1,
  stage: "REGULAR_SEASON",
  utcDate: new Date(now + 3600000).toISOString(),
  status: "TIMED",
  home: "Local",
  away: "Visitante",
  homeScore: null,
  awayScore: null,
};
const insight: MatchInsight = {
  version: 1,
  matchId: "1",
  competition: "PD",
  kickoff: match.utcDate,
  provider: "ESPN",
  eventId: "99",
  fetchedAt: new Date(now).toISOString(),
  goals: [],
  lineups: [],
  statistics: [],
};
describe("Pestañas de la ficha según datos disponibles", () => {
  it("no presenta controles para respuestas vacías, metadatos solos o fichas ajenas", () => {
    expect(availableMatchTabs(match, null, now)).toEqual([]);
    expect(
      availableMatchTabs(match, { ...insight, venue: "Estadio" }, now),
    ).toEqual([]);
    expect(
      availableMatchTabs(
        match,
        {
          ...insight,
          matchId: "2",
          statistics: [{ label: "Posesión", home: "50%", away: "50%" }],
        },
        now,
      ),
    ).toEqual([]);
  });
  it("activa solo las secciones con contenido, incluyendo ceros reales", () => {
    expect(
      availableMatchTabs(
        match,
        {
          ...insight,
          statistics: [{ label: "Tarjetas rojas", home: "0", away: "0" }],
        },
        now,
      ),
    ).toEqual(["statistics"]);
    expect(
      availableMatchTabs(
        match,
        { ...insight, lineups: [{ side: "home", players: [] }] },
        now,
      ),
    ).toEqual([]);
    expect(
      availableMatchTabs(
        match,
        {
          ...insight,
          incidents: [
            {
              side: "home",
              minute: "12'",
              kind: "yellow-card",
              player: "Jugador",
            },
          ],
          lineups: [
            { side: "home", players: [{ name: "Portero", starter: true }] },
          ],
        },
        now,
      ),
    ).toEqual(["goals", "lineups"]);
  });
  it("oculta la probabilidad caducada o cuando comienza el partido", () => {
    const data: MatchInsight = {
      ...insight,
      probability: {
        model: "ESPN",
        home: 40,
        draw: 30,
        away: 30,
        fetchedAt: new Date(now).toISOString(),
      },
    };
    expect(availableMatchTabs(match, data, now)).toEqual(["probability"]);
    expect(availableMatchTabs(match, data, now + 3600000)).toEqual([]);
    expect(
      availableMatchTabs(
        match,
        {
          ...data,
          probability: {
            ...data.probability!,
            fetchedAt: new Date(now - 37 * 3600000).toISOString(),
          },
        },
        now,
      ),
    ).toEqual([]);
    expect(
      availableMatchTabs({ ...match, status: "FINISHED" }, data, now),
    ).toEqual([]);
  });
});
