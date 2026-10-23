import { expect, it } from "vitest";
import type { Match } from "../src/lib/domain";
import {
  headToHead,
  kickoffLabel,
  knockoutContext,
  recentForm,
  seasonStats,
} from "../src/lib/matchInsights";
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
const target = fixture("target", {
  utcDate: "2026-10-10T12:00:00Z",
  status: "TIMED",
  away: "Visitante",
  awayTeamId: 202,
  homeScore: null,
  awayScore: null,
});
it("ordena los cinco últimos resultados del equipo de antiguo a reciente, incluyendo partidos fuera de casa", () => {
  const history = [
    fixture("1"),
    fixture("2", {
      utcDate: "2026-10-02T12:00:00Z",
      home: "Otro",
      homeTeamId: 404,
      away: "Local",
      awayTeamId: 101,
      homeScore: 1,
      awayScore: 2,
    }),
    fixture("3", {
      utcDate: "2026-10-03T12:00:00Z",
      homeScore: 0,
      awayScore: 0,
    }),
    fixture("4", {
      utcDate: "2026-10-04T12:00:00Z",
      homeScore: 0,
      awayScore: 1,
      competition: "CL",
      seasonId: "CL-2026",
    }),
    fixture("5", {
      utcDate: "2026-10-05T12:00:00Z",
      homeTeamId: 404,
      awayTeamId: 101,
      homeScore: 2,
      awayScore: 0,
    }),
    fixture("6", {
      utcDate: "2026-10-06T12:00:00Z",
      homeScore: 3,
      awayScore: 1,
    }),
  ];
  const form = recentForm(target, "home", [...history].reverse(), now);
  expect(form.map((r) => r.match.id)).toEqual(["2", "3", "4", "5", "6"]);
  expect(form.map((r) => r.result)).toEqual([
    "win",
    "draw",
    "loss",
    "loss",
    "win",
  ]);
});
it("no introduce resultados posteriores al partido consultado, al reloj actual ni del propio encuentro", () => {
  const history = [
    fixture("valid"),
    fixture("after", { utcDate: "2026-10-11T12:00:00Z" }),
    { ...target, status: "FINISHED", homeScore: 2, awayScore: 0 },
  ];
  expect(
    recentForm(target, "home", history, now).map((r) => r.match.id),
  ).toEqual(["valid"]);
  expect(
    recentForm(target, "home", history, Date.parse("2026-09-01T12:00:00Z")),
  ).toEqual([]);
});
it("excluye aplazados, cancelados, partidos en juego y marcadores ausentes sin inventar empates", () => {
  const history = ["POSTPONED", "CANCELLED", "IN_PLAY", "AWARDED"].map((s) =>
    fixture(s, { status: s }),
  );
  history.push(
    fixture("missing", { homeScore: null }),
    fixture("invalid", { homeScore: -1 }),
  );
  expect(recentForm(target, "home", history, now)).toEqual([]);
  expect(seasonStats(target, "home", history, now).played).toBe(0);
});
it("reconoce equipos por ID pese a cambios de nombre y mantiene compatibilidad con documentos antiguos", () => {
  const history = [
    fixture("renamed", { home: "Nombre nuevo" }),
    fixture("different", { homeTeamId: 999 }),
    fixture("legacy", {
      homeTeamId: undefined,
      awayTeamId: undefined,
      home: " local ",
    }),
  ];
  expect(
    recentForm(target, "home", history, now)
      .map((r) => r.match.id)
      .sort(),
  ).toEqual(["legacy", "renamed"]);
});
it("calcula temporada y competición por separado con goles desde la perspectiva de cada equipo", () => {
  const history = [
    fixture("win"),
    fixture("draw", {
      homeTeamId: 404,
      awayTeamId: 101,
      homeScore: 1,
      awayScore: 1,
    }),
    fixture("cl", { competition: "CL", seasonId: "CL-2026" }),
    fixture("old", { seasonId: "PD-2025" }),
  ];
  expect(seasonStats(target, "home", history, now)).toEqual({
    played: 2,
    wins: 1,
    draws: 1,
    losses: 0,
    goalsFor: 3,
    goalsAgainst: 2,
  });
});
it("limita los enfrentamientos directos a los dos equipos y a resultados anteriores", () => {
  const history = [
    fixture("other"),
    fixture("direct", { away: "Visitante", awayTeamId: 202 }),
    fixture("reverse", {
      competition: "CL",
      seasonId: "CL-2026",
      home: "Visitante",
      homeTeamId: 202,
      away: "Local",
      awayTeamId: 101,
    }),
    fixture("later", { awayTeamId: 202, utcDate: "2026-10-12T12:00:00Z" }),
  ];
  expect(
    headToHead(target, history, now)
      .map((r) => r.id)
      .sort(),
  ).toEqual(["direct", "reverse"]);
});
const first = fixture("first", {
  competition: "CL",
  seasonId: "CL-2026",
  stage: "LAST_16",
  awayTeamId: 202,
  away: "Visitante",
});
const second = fixture("second", {
  competition: "CL",
  seasonId: "CL-2026",
  stage: "LAST_16",
  utcDate: "2026-10-08T12:00:00Z",
  home: "Visitante",
  homeTeamId: 202,
  away: "Local",
  awayTeamId: 101,
  status: "TIMED",
  homeScore: null,
  awayScore: null,
});
it("identifica ida y vuelta y orienta el global hacia el local del partido seleccionado", () => {
  expect(knockoutContext(second, [second, first], now)).toMatchObject({
    leg: 2,
    firstLeg: first,
    aggregate: { home: 1, away: 2, played: 1 },
  });
  expect(knockoutContext(first, [first, second], now)).toMatchObject({
    leg: 1,
    aggregate: { home: 2, away: 1, played: 1 },
  });
});
it("suma solo los marcadores reglamentarios y no ofrece global si falta un resultado fiable", () => {
  const finished = {
    ...second,
    status: "FINISHED",
    homeScore: 0,
    awayScore: 1,
    scoreDuration: "PENALTY_SHOOTOUT",
  };
  expect(knockoutContext(finished, [first, finished], now)?.aggregate).toEqual({
    home: 1,
    away: 3,
    played: 2,
  });
  expect(
    knockoutContext(second, [first, { ...finished, homeScore: null }], now)
      ?.aggregate,
  ).toBeNull();
  expect(
    knockoutContext(second, [{ ...first, status: "POSTPONED" }, second], now)
      ?.aggregate,
  ).toBeNull();
});
it("no inventa eliminatorias a doble partido para la final, fase liga o calendarios incompletos", () => {
  expect(
    knockoutContext({ ...first, stage: "FINAL" }, [first, second], now),
  ).toBeNull();
  expect(
    knockoutContext({ ...first, stage: "LEAGUE_STAGE" }, [first, second], now),
  ).toBeNull();
  expect(knockoutContext(first, [first], now)).toEqual({
    leg: null,
    firstLeg: null,
    aggregate: null,
  });
  expect(
    knockoutContext(
      first,
      [first, { ...second, homeTeamId: 101, awayTeamId: 202 }],
      now,
    )?.leg,
  ).toBeNull();
});
it("presenta hoy y mañana con la hora local del dispositivo", () => {
  const today = new Date(2026, 9, 20, 10, 0);
  expect(
    kickoffLabel(new Date(2026, 9, 20, 18, 30).toISOString(), today.getTime()),
  ).toBe("Hoy · 18:30");
  expect(
    kickoffLabel(new Date(2026, 9, 21, 18, 30).toISOString(), today.getTime()),
  ).toBe("Mañana · 18:30");
});
