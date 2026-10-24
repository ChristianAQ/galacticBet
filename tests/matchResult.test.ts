import { expect, it } from "vitest";
import type { Match } from "../src/lib/domain";
import { finishedMatchResult } from "../src/lib/matchResult";

const fixture: Match = {
  id: "1",
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "PD-2026-REGULAR_SEASON-1",
  matchday: 1,
  stage: "REGULAR_SEASON",
  utcDate: "2026-10-24T12:00:00Z",
  status: "FINISHED",
  home: "Local",
  away: "Visitante",
  homeScore: 3,
  awayScore: 1,
  halfTimeHomeScore: 1,
  halfTimeAwayScore: 0,
};
it("distingue ganador local, visitante y empate a cero", () => {
  expect(finishedMatchResult(fixture)).toMatchObject({
    winner: "1",
    winnerName: "Local",
    sign: "1",
    totalGoals: 4,
    halfTime: { home: 1, away: 0 },
    secondHalf: { home: 2, away: 1 },
  });
  expect(
    finishedMatchResult({ ...fixture, homeScore: 0, awayScore: 2 })?.winnerName,
  ).toBe("Visitante");
  expect(
    finishedMatchResult({ ...fixture, homeScore: 0, awayScore: 0 }),
  ).toMatchObject({ winner: "X", winnerName: null, totalGoals: 0 });
});
it("excluye marcadores parciales y estados no finalizados", () => {
  for (const status of ["IN_PLAY", "PAUSED", "TIMED", "POSTPONED", "CANCELLED"])
    expect(finishedMatchResult({ ...fixture, status })).toBeNull();
});
it("no convierte un descanso ausente o incoherente en ceros o goles negativos", () => {
  for (const values of [
    { halfTimeHomeScore: undefined },
    { halfTimeHomeScore: null },
    { halfTimeHomeScore: -1 },
    { halfTimeAwayScore: 2 },
    { halfTimeHomeScore: 0.5 },
  ])
    expect(finishedMatchResult({ ...fixture, ...values })).toMatchObject({
      halfTime: null,
      secondHalf: null,
    });
});
it("mantiene separados el empate reglamentario y quien gana en penaltis o prórroga", () => {
  const extended = {
    ...fixture,
    homeScore: 1,
    awayScore: 1,
    scoreDuration: "PENALTY_SHOOTOUT",
    winner: "2" as const,
  };
  expect(finishedMatchResult(extended)).toMatchObject({
    regulation: { home: 1, away: 1 },
    sign: "X",
    winner: "2",
    winnerName: "Visitante",
    decision: "En penaltis",
    totalGoals: 2,
  });
  expect(
    finishedMatchResult({
      ...extended,
      scoreDuration: "EXTRA_TIME",
      winner: "1",
    }),
  ).toMatchObject({ winnerName: "Local", decision: "En la prórroga" });
  expect(finishedMatchResult({ ...extended, winner: undefined })).toMatchObject(
    { sign: "X", winner: null, winnerName: null },
  );
});
it("muestra el ganador oficial aunque falte el resultado reglamentario sin inventar estadísticas", () => {
  expect(
    finishedMatchResult({
      ...fixture,
      homeScore: null,
      awayScore: null,
      scoreDuration: "EXTRA_TIME",
      winner: "1",
    }),
  ).toMatchObject({
    winnerName: "Local",
    regulation: null,
    sign: null,
    halfTime: null,
    secondHalf: null,
    totalGoals: null,
  });
});
