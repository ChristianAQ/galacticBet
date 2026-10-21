import { describe, expect, it } from "vitest";
import { canPredict, score, validPrediction } from "../src/lib/domain";
describe("puntuación", () => {
  it("clásica: victoria, empate y fallo", () => {
    expect(score("classic", "1", { home: 2, away: 1 })).toBe(1);
    expect(score("classic", "X", { home: 0, away: 0 })).toBe(1);
    expect(score("classic", "2", { home: 1, away: 0 })).toBe(0);
  });
  it("exacto no acumula puntos", () => {
    expect(score("exact", { home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3);
    expect(score("exact", { home: 3, away: 1 }, { home: 2, away: 1 })).toBe(1);
    expect(score("exact", { home: 0, away: 0 }, { home: 2, away: 1 })).toBe(0);
  });
  it("empate no exacto", () =>
    expect(score("exact", { home: 1, away: 1 }, { home: 0, away: 0 })).toBe(1));
});
describe("cierre", () => {
  const kickoff = "2026-10-24T19:00:00Z";
  const t = Date.parse(kickoff);
  it("cierra en el instante de inicio", () => {
    expect(canPredict(kickoff, t - 1)).toBe(true);
    expect(canPredict(kickoff, t)).toBe(false);
    expect(canPredict(kickoff, t + 1)).toBe(false);
  });
  it("no permite aplazados o cancelados", () => {
    expect(canPredict(kickoff, t - 100, "POSTPONED")).toBe(false);
    expect(canPredict(kickoff, t - 100, "CANCELLED")).toBe(false);
  });
  it("valida goles", () => {
    expect(validPrediction({ home: -1, away: 0 })).toBe(false);
    expect(validPrediction({ home: 1.5, away: 0 })).toBe(false);
    expect(validPrediction({ home: 0, away: 0 })).toBe(true);
  });
});
