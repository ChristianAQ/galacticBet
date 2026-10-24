import { describe, expect, it } from "vitest";
import type { Match } from "../src/lib/domain";
import {
  kickoffCountdown,
  roundHasStarted,
  upcomingMatches,
} from "../src/lib/schedule";

const now = Date.parse("2026-10-24T12:00:00Z");
function fixture(
  id: string,
  date: string,
  status = "TIMED",
  roundId = "PD-2026-REGULAR_SEASON-10",
): Match {
  return {
    id,
    competition: "PD",
    seasonId: "PD-2026",
    roundId,
    matchday: 10,
    stage: "REGULAR_SEASON",
    utcDate: date,
    status,
    home: "Local",
    away: "Visitante",
    homeScore: null,
    awayScore: null,
  };
}

describe("agenda de próximos encuentros", () => {
  it("ordena por inicio entre competiciones sin alterar el calendario original", () => {
    const later = fixture("later", "2026-10-26T20:00:00Z");
    const earlier = {
      ...fixture("earlier", "2026-10-24T18:00:00Z"),
      competition: "CL" as const,
    };
    const matches = [later, earlier];
    expect(upcomingMatches(matches, now).map((m) => m.id)).toEqual([
      "earlier",
      "later",
    ]);
    expect(matches[0]).toBe(later);
  });
  it("excluye aplazados, cancelados, partidos ya iniciados y fechas inválidas", () => {
    expect(
      upcomingMatches(
        [
          fixture("postponed", "2026-10-25T18:00:00Z", "POSTPONED"),
          fixture("cancelled", "2026-10-25T18:00:00Z", "CANCELLED"),
          fixture("live", "2026-10-24T12:00:00Z", "IN_PLAY"),
          fixture("old", "2026-10-24T11:00:00Z"),
          fixture("invalid", "unknown"),
          fixture("next", "2026-10-25T18:00:00Z", "SCHEDULED"),
        ],
        now,
      ).map((m) => m.id),
    ).toEqual(["next"]);
  });
  it("pasa al siguiente encuentro en el instante de inicio", () => {
    expect(
      upcomingMatches([fixture("now", new Date(now).toISOString())], now),
    ).toEqual([]);
  });
  it("distingue una jornada en curso de otra que aún no ha empezado", () => {
    const next = fixture("next", "2026-10-25T18:00:00Z");
    const old = fixture("old", "2026-10-23T18:00:00Z", "FINISHED");
    expect(roundHasStarted([old, next], next, now)).toBe(true);
    expect(
      roundHasStarted([{ ...old, roundId: "another-round" }, next], next, now),
    ).toBe(false);
    expect(
      roundHasStarted([{ ...old, status: "POSTPONED" }, next], next, now),
    ).toBe(false);
    expect(
      roundHasStarted([{ ...old, status: "CANCELLED" }, next], next, now),
    ).toBe(false);
  });
  it("presenta días, horas y minutos sin depender de la zona horaria", () => {
    expect(kickoffCountdown("2026-10-26T15:00:00Z", now)).toBe("En 2 d 3 h");
    expect(kickoffCountdown("2026-10-24T14:30:00Z", now)).toBe("En 2 h 30 min");
    expect(kickoffCountdown("2026-10-24T12:45:00Z", now)).toBe("En 45 min");
    expect(kickoffCountdown("2026-10-24T12:00:30Z", now)).toBe(
      "En menos de 1 min",
    );
  });
});
