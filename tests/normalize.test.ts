import { expect, it } from "vitest";
import { normalize, type ApiMatch } from "../scripts/normalize";
const fixture: ApiMatch = {
  id: 1,
  utcDate: "2026-10-24T19:00:00Z",
  status: "FINISHED",
  matchday: 1,
  stage: "LAST_16",
  season: { id: 2, startDate: "2026-08-01", endDate: "2027-06-01" },
  homeTeam: { name: "Local" },
  awayTeam: { name: "Visitante" },
  score: {
    duration: "EXTRA_TIME",
    fullTime: { home: 3, away: 2 },
    regularTime: { home: 1, away: 1 },
  },
};
it("excluye prórroga y penaltis", () => {
  const m = normalize(fixture, "CL");
  expect(m.homeScore).toBe(1);
  expect(m.awayScore).toBe(1);
});
it("no inventa marcador reglamentario ausente", () => {
  const m = normalize(
    { ...fixture, score: { ...fixture.score, regularTime: undefined } },
    "CL",
  );
  expect(m.homeScore).toBeNull();
});
it("diferencia fases con igual jornada", () =>
  expect(normalize(fixture, "CL").roundId).not.toBe(
    normalize({ ...fixture, stage: "LEAGUE_STAGE" }, "CL").roundId,
  ));
it("mantiene identidad estable al reejecutar", () =>
  expect(normalize(fixture, "CL")).toEqual(normalize(fixture, "CL")));
