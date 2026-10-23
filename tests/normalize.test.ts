import { expect, it } from "vitest";
import { normalize, type ApiMatch } from "../scripts/normalize";
import { decodeCalendar, encodeCalendar } from "../src/lib/calendar";
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
it("conserva los identificadores de equipo y la duración sin alterar el resultado a 90 minutos", () => {
  const m = normalize(
    {
      ...fixture,
      homeTeam: { id: 86, name: "Nombre completo", shortName: "Local" },
      awayTeam: { id: 81, name: "Visitante" },
    },
    "CL",
  );
  expect(m).toMatchObject({
    homeTeamId: 86,
    awayTeamId: 81,
    scoreDuration: "EXTRA_TIME",
    homeScore: 1,
    awayScore: 1,
  });
  expect(normalize(fixture, "CL").homeTeamId).toBeNull();
});
it("conserva las eliminatorias reales con equipos aún por determinar sin romper el calendario público", () => {
  const m = normalize(
    {
      ...fixture,
      status: "SCHEDULED",
      homeTeam: { name: null, shortName: null, crest: null },
      awayTeam: { name: null },
      score: { duration: null, fullTime: { home: null, away: null } },
    },
    "CL",
  );
  expect(m.home).toBe("Por determinar");
  expect(m.away).toBe("Por determinar");
  expect(m.homeScore).toBeNull();
  expect(
    decodeCalendar({
      formatVersion: 1,
      seasonId: m.seasonId,
      payload: encodeCalendar([m]),
    }),
  ).toEqual([m]);
});
