import { expect, it, vi } from "vitest";
import {
  allocateSportApiRequests,
  SPORTAPI_WINDOW_MS,
  sportApiRequestGate,
  type SportApiLedger,
} from "../scripts/sportApiBudget";
const now = Date.parse("2026-10-30T12:00:00Z");
it("reserva como máximo 1800 peticiones en 24 horas y bloquea los trabajos repetidos", () => {
  let ledger: SportApiLedger = { version: 1, reservations: [] };
  for (let n = 0; n < 45; n++) {
    const next = allocateSportApiRequests(ledger, `run-${n}`, 40, now + n);
    expect(next.granted).toBe(40);
    ledger = next.ledger;
  }
  expect(allocateSportApiRequests(ledger, "extra", 40, now + 100).granted).toBe(
    0,
  );
  expect(allocateSportApiRequests(ledger, "run-0", 40, now + 100).granted).toBe(
    0,
  );
  // Exactly 24 h is still counted; release only once it is strictly older.
  expect(
    allocateSportApiRequests(ledger, "next", 40, now + SPORTAPI_WINDOW_MS)
      .granted,
  ).toBe(0);
  expect(
    allocateSportApiRequests(ledger, "next", 40, now + SPORTAPI_WINDOW_MS + 1)
      .granted,
  ).toBe(40);
});
it("no reinicia la cuota a medianoche ni al retroceder el reloj", () => {
  const ledger: SportApiLedger = {
    version: 1,
    reservations: Array.from({ length: 45 }, (_, i) => ({
      id: `run-${i}`,
      at: now,
      count: 40,
    })),
  };
  expect(
    allocateSportApiRequests(ledger, "next", 40, now + 12 * 3600000).granted,
  ).toBe(0);
  expect(
    allocateSportApiRequests(ledger, "next", 40, now - 3600000).granted,
  ).toBe(0);
});
it("admite el último bloque parcial y rechaza contadores dañados", () => {
  const ledger: SportApiLedger = {
    version: 1,
    reservations: Array.from({ length: 45 }, (_, i) => ({
      id: `run-${i}`,
      at: now,
      count: i === 44 ? 35 : 40,
    })),
  };
  expect(allocateSportApiRequests(ledger, "next", 40, now).granted).toBe(5);
  for (const value of [
    null,
    { version: 2, reservations: [] },
    { version: 1, reservations: [{ id: "bad", at: now, count: -1 }] },
  ])
    expect(() => allocateSportApiRequests(value, "next", 40, now)).toThrow();
  expect(() => allocateSportApiRequests(undefined, "next", 41, now)).toThrow();
});
it("consume también los fallos y no permite gastar dos veces las últimas plazas concurrentes", async () => {
  const gate = sportApiRequestGate(2);
  const call = vi
    .fn()
    .mockRejectedValueOnce(new Error("429"))
    .mockResolvedValue("ok");
  const results = await Promise.allSettled([
    gate.run(call),
    gate.run(call),
    gate.run(call),
  ]);
  expect(results.map((r) => r.status)).toEqual([
    "rejected",
    "fulfilled",
    "rejected",
  ]);
  expect(call).toHaveBeenCalledTimes(2);
  expect(gate.remaining).toBe(0);
});
it("permite detener el proveedor sin consumir más capacidad", async () => {
  const gate = sportApiRequestGate(40);
  const call = vi.fn();
  gate.stop();
  await expect(gate.run(call)).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
