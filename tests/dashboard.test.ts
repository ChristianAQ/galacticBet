import { describe, expect, it } from "vitest";
import type { Match } from "../src/lib/domain";
import {
  liveMatches,
  openRounds,
  recentResults,
} from "../src/lib/homeDashboard";
import { currentLeagueTable, leagueTable } from "../src/lib/leagueTable";
import { buildRanking, rankingSummary } from "../src/lib/rankings";

const now = Date.parse("2026-10-20T12:00:00Z");
const fixture = (id: string, extra: Partial<Match> = {}): Match => ({
  id,
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "PD-2026-REGULAR_SEASON-1",
  matchday: 1,
  stage: "REGULAR_SEASON",
  utcDate: "2026-10-01T12:00:00Z",
  status: "FINISHED",
  home: "Local",
  away: "Rival",
  homeTeamId: 1,
  awayTeamId: 2,
  homeScore: 2,
  awayScore: 1,
  ...extra,
});

describe("Tabla de liga", () => {
  it("ordena por puntos, diferencia y goles, y guarda la forma reciente", () => {
    const rows = leagueTable([
      fixture("a"),
      fixture("b", {
        utcDate: "2026-10-02T12:00:00Z",
        home: "Tercero",
        homeTeamId: 3,
        away: "Rival",
        homeScore: 0,
        awayScore: 3,
      }),
      fixture("c", { status: "TIMED", homeScore: null, awayScore: null }),
    ]);
    expect(rows.map((r) => [r.name, r.points, r.played])).toEqual([
      ["Rival", 3, 2],
      ["Local", 3, 1],
      ["Tercero", 0, 1],
    ]);
    expect(rows[0].form).toEqual(["loss", "win"]);
  });
  it("usa la temporada vigente e ignora otras fases y resultados futuros", () => {
    const rows = currentLeagueTable(
      [
        fixture("old", { seasonId: "PD-2025" }),
        fixture("new", { utcDate: "2026-10-10T12:00:00Z" }),
        fixture("cup", { utcDate: "2026-10-11T12:00:00Z", stage: "LAST_16" }),
        fixture("later", { utcDate: "2026-10-25T12:00:00Z" }),
      ],
      "PD",
      now,
    );
    expect(rows.find((r) => r.name === "Local")?.played).toBe(1);
  });
});

describe("Inicio", () => {
  it("elige la jornada abierta más próxima de cada competición", () => {
    const rounds = openRounds(
      [
        fixture("played"),
        fixture("next-a", {
          roundId: "PD-2026-REGULAR_SEASON-2",
          matchday: 2,
          status: "TIMED",
          utcDate: "2026-10-24T12:00:00Z",
        }),
        fixture("later", {
          roundId: "PD-2026-REGULAR_SEASON-3",
          matchday: 3,
          status: "TIMED",
          utcDate: "2026-10-31T12:00:00Z",
        }),
        fixture("cl", {
          competition: "CL",
          roundId: "CL-2026-LEAGUE_STAGE-4",
          stage: "LEAGUE_STAGE",
          matchday: 4,
          status: "TIMED",
          utcDate: "2026-10-21T19:00:00Z",
        }),
      ],
      now,
    );
    expect(rounds.map((r) => [r.competition, r.short])).toEqual([
      ["CL", "J4"],
      ["PD", "J2"],
    ]);
  });
  it("separa partidos en directo y últimos resultados", () => {
    const list = [
      fixture("old"),
      fixture("recent", { utcDate: "2026-10-19T12:00:00Z" }),
      fixture("live", { status: "IN_PLAY", utcDate: "2026-10-20T11:30:00Z" }),
    ];
    expect(liveMatches(list).map((m) => m.id)).toEqual(["live"]);
    expect(recentResults(list, now).map((m) => m.id)).toEqual(["recent", "old"]);
  });
  it("resume la posición del usuario frente al líder y al siguiente", () => {
    const rows = buildRanking(
      [
        { id: "a", name: "Ana", avatar: null },
        { id: "b", name: "Bea", avatar: null },
        { id: "c", name: "Carla", avatar: null },
      ],
      [
        {
          id: "PD-2026",
          competition: "PD",
          standings: [
            { id: "a", points: 10, hits: 10, rounds: {} },
            { id: "b", points: 7, hits: 7, rounds: {} },
            { id: "c", points: 3, hits: 3, rounds: {} },
          ],
        },
      ],
      "PD",
    );
    expect(rankingSummary(rows, "c")).toMatchObject({
      total: 3,
      gapToLeader: 7,
      gapToAbove: 4,
      sharedLead: false,
    });
    expect(rankingSummary(rows, "a").me?.position).toBe(1);
  });
});
