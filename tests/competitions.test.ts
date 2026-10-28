import { expect, it } from "vitest";
import {
  COMPETITION_CODES,
  competitionCode,
  competitionName,
} from "../src/lib/competitions";
import { normalize, type ApiMatch } from "../scripts/normalize";
import { decodeCalendar, encodeCalendar } from "../src/lib/calendar";
import { createPreferenceStore } from "../src/lib/preferences";
import { validDeliveredPicks } from "../src/lib/roundDelivery";
import { knockoutContext } from "../src/lib/matchInsights";
const fixture: ApiMatch = {
  id: 1,
  utcDate: "2026-10-28T20:00:00Z",
  status: "FINISHED",
  matchday: null,
  stage: "LAST_64",
  season: { id: 1, startDate: "2026-08-01", endDate: "2027-06-01" },
  homeTeam: { id: 1, name: "Local" },
  awayTeam: { id: 2, name: "Visitante" },
  score: {
    duration: "EXTRA_TIME",
    fullTime: { home: 2, away: 1 },
    regularTime: { home: 1, away: 1 },
  },
};
it("acepta las cuatro competiciones sin confundir sus calendarios o sus nombres", () => {
  for (const code of COMPETITION_CODES) {
    const match = normalize(fixture, code);
    expect(
      decodeCalendar({
        formatVersion: 1,
        seasonId: `${code}-2026`,
        payload: encodeCalendar([match]),
      }),
    ).toEqual([match]);
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(1);
    expect(competitionCode(code)).toBe(code);
  }
  expect(competitionName("PL")).toBe("Premier League");
  expect(competitionName("CDR")).toBe("Copa del Rey");
  expect(competitionCode("INVALID")).toBe("PD");
});
it("recuerda Premier y Copa tras recargar las preferencias", () => {
  const data = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  });
  const store = createPreferenceStore(storage);
  store.update("a", { competition: "PL" });
  store.update("b", { competition: "CDR" });
  expect(createPreferenceStore(storage).get("a").competition).toBe("PL");
  expect(createPreferenceStore(storage).get("b").competition).toBe("CDR");
});
it("admite una ronda grande de Copa pero rechaza entregas fuera del límite y valores inválidos", () => {
  const ids = Array.from({ length: 64 }, (_, i) => String(i));
  const picks = Object.fromEntries(ids.map((id) => [id, "1"]));
  expect(validDeliveredPicks("classic", ids, picks)).toBe(true);
  expect(
    validDeliveredPicks("classic", [...ids, "65"], { ...picks, "65": "1" }),
  ).toBe(false);
  expect(
    validDeliveredPicks("classic", ids, { ...picks, "63": "invalid" }),
  ).toBe(false);
});
it("no trata una eliminatoria de Copa a partido único como ida y vuelta", () => {
  const match = normalize(fixture, "CDR");
  expect(knockoutContext(match, [match])).toBeNull();
  expect(normalize({ ...fixture, stage: "LAST_32" }, "CDR").roundId).not.toBe(
    match.roundId,
  );
});
