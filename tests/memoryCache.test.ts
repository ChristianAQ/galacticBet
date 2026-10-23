import { afterEach, expect, it, vi } from "vitest";
import { createMemoryCache } from "../src/lib/memoryCache";
afterEach(() => vi.useRealTimers());
it("comparte peticiones simultáneas y vuelve al servidor al caducar", async () => {
  vi.useFakeTimers();
  const cache = createMemoryCache();
  let reads = 0;
  const load = async () => ++reads;
  expect(
    await Promise.all([
      cache.read("a", load, 30000),
      cache.read("a", load, 30000),
    ]),
  ).toEqual([1, 1]);
  expect(await cache.read("a", load, 30000)).toBe(1);
  expect(reads).toBe(1);
  vi.advanceTimersByTime(30001);
  expect(cache.peek("a")).toBeUndefined();
  expect(await cache.read("a", load, 30000)).toBe(2);
});
it("limpia los datos de sesión e impide que una petición antigua repueble la caché", async () => {
  const cache = createMemoryCache();
  let complete!: (value: string) => void;
  const pending = cache.read(
    "alice",
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
    30000,
  );
  await Promise.resolve();
  cache.clear();
  complete("private");
  await pending;
  expect(cache.peek("alice")).toBeUndefined();
  expect(await cache.read("bob", async () => "new user", 30000)).toBe(
    "new user",
  );
});
it("no conserva errores y limita el número de entradas", async () => {
  const cache = createMemoryCache(2);
  await expect(
    cache.read(
      "bad",
      async () => {
        throw new Error("offline");
      },
      10000,
    ),
  ).rejects.toThrow("offline");
  expect(await cache.read("bad", async () => 1, 10000)).toBe(1);
  await cache.read("second", async () => 2, 10000);
  await cache.read("third", async () => 3, 10000);
  expect(cache.peek("bad")).toBeUndefined();
  expect(cache.peek("third")).toBe(3);
});
