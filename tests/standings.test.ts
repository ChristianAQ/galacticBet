import { expect, it } from "vitest";
import { resultFingerprint, scoreRound, sumRounds } from "../scripts/standings";
import type { Match } from "../src/lib/domain";
const match: Match = {
  id: "1",
  competition: "CL",
  seasonId: "CL-2026",
  roundId: "r",
  matchday: 1,
  stage: "LEAGUE_STAGE",
  utcDate: "2026-10-01T19:00:00Z",
  status: "FINISHED",
  home: "A",
  away: "B",
  homeScore: 2,
  awayScore: 1,
};
it("reemplaza totales sin duplicarlos en reejecuciones", () => {
  const predictions = [
    { userId: "a", matchId: "1", value: { home: 2, away: 1 } },
  ];
  const once = scoreRound("exact", [match], predictions, ["a"]);
  const twice = scoreRound("exact", [match], predictions, ["a"]);
  expect(once).toEqual(twice);
  expect(sumRounds({ r: twice.get("a")! }).points).toBe(3);
});
it("las correcciones de resultados recalculan el total", () => {
  const predictions = [{ userId: "a", matchId: "1", value: "1" as const }];
  expect(
    scoreRound("classic", [match], predictions, ["a"]).get("a")?.points,
  ).toBe(1);
  expect(
    scoreRound("classic", [{ ...match, homeScore: 0 }], predictions, ["a"]).get(
      "a",
    )?.points,
  ).toBe(0);
  expect(resultFingerprint([match])).not.toBe(
    resultFingerprint([{ ...match, homeScore: 0 }]),
  );
});
it("no puntúa aplazados, marcadores ausentes ni antiguos miembros", () => {
  expect(
    scoreRound(
      "classic",
      [{ ...match, status: "POSTPONED" }],
      [{ userId: "a", matchId: "1", value: "1" }],
      ["a"],
    ).get("a")?.points,
  ).toBe(0);
  expect(
    scoreRound(
      "classic",
      [{ ...match, homeScore: null }],
      [{ userId: "a", matchId: "1", value: "1" }],
      ["a"],
    ).get("a")?.points,
  ).toBe(0);
  expect(
    scoreRound(
      "classic",
      [match],
      [{ userId: "b", matchId: "1", value: "1" }],
      ["a"],
    ).has("b"),
  ).toBe(false);
});
it("sumar jornadas conserva aciertos y puntos independientes", () =>
  expect(
    sumRounds({ a: { points: 3, hits: 1 }, b: { points: 1, hits: 1 } }),
  ).toMatchObject({ points: 4, hits: 2 }));
