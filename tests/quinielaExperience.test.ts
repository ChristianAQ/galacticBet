import { describe, expect, it } from "vitest";
import type { Match } from "../src/lib/domain";
import { countdownLabel, matchPreview } from "../src/lib/matchPreview";
import { roundOptions, roundShortLabel } from "../src/lib/roundOptions";
import {
  parseFormation,
  pitchRows,
  positionRole,
  shortPlayerName,
} from "../src/lib/matchPresentation";

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
  homeTeamId: 101,
  awayTeamId: 303,
  homeScore: 2,
  awayScore: 1,
  ...extra,
});

describe("Selector de jornadas", () => {
  it("resume cada jornada con su estado y etiqueta corta", () => {
    const rounds = roundOptions(
      [
        fixture("a"),
        fixture("b", { utcDate: "2026-10-02T12:00:00Z" }),
        fixture("c", {
          roundId: "R2",
          matchday: 2,
          status: "IN_PLAY",
          utcDate: "2026-10-20T11:00:00Z",
        }),
        fixture("d", {
          roundId: "R3",
          matchday: 3,
          status: "TIMED",
          utcDate: "2026-10-27T12:00:00Z",
        }),
        fixture("e", {
          roundId: "R4",
          matchday: 4,
          status: "TIMED",
          utcDate: "2026-10-19T12:00:00Z",
        }),
      ],
      now,
    );
    expect(rounds.map((r) => [r.short, r.state, r.matches])).toEqual([
      ["J1", "finished", 2],
      ["J2", "live", 1],
      ["J3", "open", 1],
      ["J4", "playing", 1],
    ]);
    expect(rounds[0].start).toBe("2026-10-01T12:00:00Z");
    expect(rounds[0].end).toBe("2026-10-02T12:00:00Z");
    expect(roundShortLabel({ stage: "LAST_16", matchday: 0 })).toBe("Octavos");
  });
});

describe("Previa del partido", () => {
  const target = fixture("target", {
    utcDate: "2026-10-25T12:00:00Z",
    status: "TIMED",
    away: "Visitante",
    awayTeamId: 202,
    homeScore: null,
    awayScore: null,
  });
  const history = [
    fixture("1", { utcDate: "2026-10-01T12:00:00Z" }),
    fixture("2", { utcDate: "2026-10-05T12:00:00Z", homeScore: 3, awayScore: 0 }),
    fixture("3", { utcDate: "2026-10-09T12:00:00Z", homeScore: 1, awayScore: 0 }),
    fixture("4", {
      utcDate: "2026-10-12T12:00:00Z",
      home: "Visitante",
      homeTeamId: 202,
      away: "Local",
      awayTeamId: 101,
      homeScore: 0,
      awayScore: 0,
    }),
    fixture("5", {
      utcDate: "2026-10-15T12:00:00Z",
      home: "Visitante",
      homeTeamId: 202,
      homeScore: 0,
      awayScore: 2,
    }),
  ];
  it("calcula clasificación, rendimiento, forma y cara a cara antes del inicio", () => {
    const preview = matchPreview(target, [...history, target], now);
    expect(preview.home).toMatchObject({
      played: 4,
      wins: 3,
      draws: 1,
      losses: 0,
      goalsFor: 6,
      goalsAgainst: 1,
      cleanSheets: 3,
      position: 1,
      points: 10,
    });
    expect(preview.home.venueRecord).toEqual({
      played: 3,
      wins: 3,
      draws: 0,
      losses: 0,
    });
    expect(preview.away).toMatchObject({ played: 2, position: 3, points: 1 });
    expect(preview.tableSize).toBe(3);
    expect(preview.headToHead).toEqual({ played: 1, home: 0, draws: 1, away: 0 });
    expect(preview.home.form.at(-1)).toMatchObject({
      id: "4",
      result: "draw",
      opponent: "Visitante",
      venue: "away",
    });
    expect(preview.facts).toContain("Local lleva 4 partidos sin perder.");
    expect(preview.facts).toContain(
      "Local ha ganado todos sus partidos en casa esta temporada.",
    );
    expect(preview.hasData).toBe(true);
  });
  it("no usa resultados posteriores al inicio y formatea la cuenta atrás", () => {
    const preview = matchPreview(
      target,
      [fixture("late", { utcDate: "2026-10-26T12:00:00Z" })],
      Date.parse("2026-10-30T12:00:00Z"),
    );
    expect(preview.hasData).toBe(false);
    expect(countdownLabel("2026-10-22T15:30:00Z", now)).toBe("2 d 3 h");
    expect(countdownLabel("2026-10-20T13:05:00Z", now)).toBe("1 h 5 min");
  });
});

describe("Alineación sobre el campo", () => {
  it("interpreta códigos de ESPN y nombres de posición", () => {
    expect(positionRole("CD-L")).toEqual({ rank: 1, lateral: 1 });
    expect(positionRole("AM-R")).toEqual({ rank: 5, lateral: 3 });
    expect(positionRole("LB")).toEqual({ rank: 1, lateral: 0 });
    expect(positionRole("Left Wing Back")).toEqual({ rank: 2, lateral: 0 });
    expect(positionRole("SUB")).toBeNull();
    expect(parseFormation("4-2-3-1")).toEqual([4, 2, 3, 1]);
    expect(parseFormation("4-4")).toBeNull();
    expect(shortPlayerName("Frenkie de Jong")).toBe("de Jong");
    expect(shortPlayerName("Pedri")).toBe("Pedri");
  });
  it("reparte el once según la formación, de izquierda a derecha", () => {
    const xi = [
      ["Portero", "G"],
      ["Lateral D", "RB"],
      ["Central D", "CD-R"],
      ["Central I", "CD-L"],
      ["Lateral I", "LB"],
      ["Pivote", "DM"],
      ["Interior I", "CM-L"],
      ["Interior D", "CM-R"],
      ["Extremo D", "RW"],
      ["Delantero", "CF"],
      ["Extremo I", "LW"],
    ].map(([name, position]) => ({ name, position, starter: true }));
    const { rows, unknown } = pitchRows(
      [...xi, { name: "Suplente", position: "SUB", starter: false }],
      "4-3-3",
    );
    expect(unknown).toEqual([]);
    expect(rows.map((r) => r.map((p) => p.name))).toEqual([
      ["Portero"],
      ["Lateral I", "Central I", "Central D", "Lateral D"],
      ["Interior I", "Pivote", "Interior D"],
      ["Extremo I", "Delantero", "Extremo D"],
    ]);
  });
});
