import { describe, expect, it } from "vitest";
import {
  parseProbability,
  probabilityFromOdds,
  validProbability,
} from "../src/lib/matchProbability";
const fetchedAt = "2026-10-28T10:00:00Z";
const predictor = {
  homeTeam: { id: "1", gameProjection: "45.2" },
  awayTeam: { id: "2", gameProjection: "30.1" },
  drawChance: "24.7",
};
describe("Probabilidades reales del proveedor", () => {
  it("acepta únicamente tres porcentajes consistentes vinculados a ambos equipos", () => {
    expect(parseProbability(predictor, "1", "2", fetchedAt)).toEqual({
      home: 45.2,
      draw: 24.7,
      away: 30.1,
      fetchedAt,
      model: "ESPN",
    });
    expect(parseProbability(predictor, "2", "1", fetchedAt)).toBeUndefined();
  });
  it("rechaza datos incompletos y nunca calcula el empate ausente", () => {
    for (const drawChance of [undefined, null, "", " ", "NaN", -1, 101, "50"])
      expect(
        parseProbability({ ...predictor, drawChance }, "1", "2", fetchedAt),
      ).toBeUndefined();
    expect(parseProbability(null, "1", "2", fetchedAt)).toBeUndefined();
    expect(parseProbability(predictor, "1", "2", "invalid")).toBeUndefined();
    expect(
      validProbability({
        home: 50,
        draw: 30,
        away: 20,
        fetchedAt,
        model: "invented",
      }),
    ).toBe(false);
  });
});

describe("Probabilidades implícitas a partir de cuotas ESPN", () => {
  const market = {
    provider: { name: "Proveedor de prueba" },
    lastUpdated: fetchedAt,
    homeTeamOdds: { moneyLine: -110 },
    drawOdds: { moneyLine: 250 },
    awayTeamOdds: { moneyLine: 300 },
  };
  it("elimina el margen de un mercado completo e identifica su fuente", () => {
    const p = probabilityFromOdds([market], fetchedAt)!;
    expect(p.model).toBe("ESPN_ODDS");
    expect(p.home + p.draw + p.away).toBeCloseTo(100);
    expect(p.home).toBeCloseTo(49.4382, 3);
    expect(p.bookmaker).toBe("Proveedor de prueba");
    expect(p.marketUpdatedAt).toBe(new Date(fetchedAt).toISOString());
  });
  it("no inventa cuotas ausentes ni utiliza mercados antiguos o sin fecha", () => {
    for (const changes of [
      { drawOdds: undefined },
      { lastUpdated: undefined },
      { lastUpdated: "2020-01-01" },
      { lastUpdated: "2030-01-01" },
      { homeTeamOdds: { moneyLine: 0 } },
      { drawOdds: { moneyLine: "100abc" } },
      { provider: null },
    ]) {
      expect(
        probabilityFromOdds([{ ...market, ...changes }], fetchedAt),
      ).toBeUndefined();
    }
  });
});
