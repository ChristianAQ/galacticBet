import {
  validPrediction,
  type Match,
  type Mode,
  type PredictionValue,
} from "./domain";

export const MAX_ROUND_MATCHES = 32;
export const DELIVERY_VERSION = 2;

export function roundRequirements(matches: Match[]) {
  const required = matches.filter(
    (m) => !["POSTPONED", "CANCELLED"].includes(m.status),
  );
  const starts = required
    .map((m) => Date.parse(m.utcDate))
    .filter(Number.isFinite);
  return {
    matchIds: required.map((m) => m.id).sort(),
    deadline: starts.length ? Math.min(...starts) : null,
  };
}

export function validDeliveredPicks(
  mode: Mode,
  ids: string[],
  picks: unknown,
): picks is Record<string, PredictionValue> {
  if (
    !["classic", "exact"].includes(mode) ||
    !picks ||
    typeof picks !== "object" ||
    Array.isArray(picks) ||
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.length > MAX_ROUND_MATCHES
  )
    return false;
  const values = picks as Record<string, PredictionValue>;
  return (
    Object.keys(values).length === ids.length &&
    ids.every((id) => {
      if (!Object.hasOwn(values, id)) return false;
      const value = values[id];
      return mode === "classic"
        ? typeof value === "string" && ["1", "X", "2"].includes(value)
        : typeof value === "object" &&
            value !== null &&
            Object.keys(value).every((key) => ["home", "away"].includes(key)) &&
            validPrediction(value);
    })
  );
}

export function requiresDelivery(matches: Match[], policyFrom?: string) {
  const { deadline } = roundRequirements(matches);
  return (
    deadline !== null &&
    Boolean(policyFrom) &&
    deadline >= Date.parse(policyFrom!)
  );
}

// Bounded strings let Firestore validate the whole entry without a rule read per fixture.
export function encodeDelivery(
  mode: Mode,
  matchIds: string[],
  picks: Record<string, PredictionValue>,
) {
  if (!validDeliveredPicks(mode, matchIds, picks))
    throw new Error("La entrega no está completa.");
  return {
    mode,
    matchIds,
    selections:
      mode === "classic"
        ? matchIds.map((id) => picks[id]).join("")
        : matchIds
            .map((id) => {
              const value = picks[id] as { home: number; away: number };
              return `${value.home}:${value.away}`;
            })
            .join(","),
  };
}

export function decodeDelivery(
  data: Record<string, unknown>,
): Record<string, PredictionValue> {
  const ids = data.matchIds;
  const mode = data.mode;
  if (
    !Array.isArray(ids) ||
    !ids.every((id) => typeof id === "string") ||
    new Set(ids).size !== ids.length ||
    typeof data.selections !== "string" ||
    data.selections.length > MAX_ROUND_MATCHES * 6 - 1 ||
    !["classic", "exact"].includes(String(mode))
  )
    throw new Error("Entrega no válida.");
  const values =
    mode === "classic"
      ? data.selections.split("")
      : data.selections.split(",").map((pair) => {
          if (!/^[0-9]{1,2}:[0-9]{1,2}$/.test(pair))
            throw new Error("Marcador no válido.");
          const [home, away] = pair.split(":").map(Number);
          return { home, away };
        });
  const picks = Object.fromEntries(ids.map((id, i) => [id, values[i]]));
  if (
    values.length !== ids.length ||
    !validDeliveredPicks(mode as Mode, ids, picks)
  )
    throw new Error("Entrega incompleta.");
  return picks;
}
