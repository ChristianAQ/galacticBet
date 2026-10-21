import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Match, Mode } from "../src/lib/domain";
import { normalize, type ApiMatch } from "./normalize";
import {
  resultFingerprint,
  scoreRound,
  sumRounds,
  type Standing,
  type StoredPrediction,
} from "./standings";
const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) throw new Error("Falta FOOTBALL_DATA_TOKEN (solo backend).");
// GitHub secret may contain a service-account JSON. Never log it or place it in VITE_*.
function backendCredential() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!process.env.FIREBASE_PROJECT_ID)
      throw new Error(
        "Con ADC, indica explícitamente FIREBASE_PROJECT_ID para evitar escribir en un proyecto desconocido.",
      );
    return applicationDefault();
  }
  try {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT no contiene una cuenta de servicio JSON válida. Revisa el secret sin publicarlo en los logs.",
    );
  }
}
initializeApp({
  credential: backendCredential(),
  projectId: process.env.FIREBASE_PROJECT_ID,
});
const db = getFirestore();
async function api<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.football-data.org/v4${path}`, {
      headers: { "X-Auth-Token": token! },
      signal: AbortSignal.timeout(25000),
    });
    if (response.ok) return (await response.json()) as T;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const wait = Math.min(
        30,
        Math.max(2, Number(response.headers.get("Retry-After")) || 5),
      );
      console.warn(
        `Football-Data HTTP ${response.status}: reintento en ${wait}s`,
      );
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(
      `Football-Data HTTP ${response.status} en ${path}. Comprueba acceso, cuota y plan.`,
    );
  }
  throw new Error("Reintentos agotados");
}
async function sync() {
  const available = await api<{
    competitions: {
      code: string;
      name: string;
      emblem: string;
      currentSeason?: { startDate: string };
    }[];
  }>("/competitions");
  for (const code of ["PD", "CL"] as const) {
    const competition = available.competitions.find((c) => c.code === code);
    if (!competition)
      throw new Error(`Competición ${code} no disponible en este plan.`);
    const { matches } = await api<{ matches: ApiMatch[] }>(
      `/competitions/${code}/matches`,
    );
    if (!Array.isArray(matches) || !matches.length)
      throw new Error(
        `Calendario ${code} vacío; se conserva la base anterior.`,
      );
    await db.doc(`competitions/${code}`).set(
      {
        code,
        name: competition.name,
        emblem: competition.emblem,
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    // Sequential chunks stay below Firestore's 500-write batch limit.
    for (let i = 0; i < matches.length; i += 150) {
      const batch = db.batch();
      const metadata = new Map<string, Record<string, unknown>>();
      for (const raw of matches.slice(i, i + 150)) {
        const m = normalize(raw, code);
        if (!Number.isFinite(Date.parse(m.utcDate)))
          throw new Error(`Fecha inválida en partido ${m.id}`);
        batch.set(db.doc(`matches/${m.id}`), {
          ...m,
          kickoffAt: Timestamp.fromDate(new Date(m.utcDate)),
          providerSeasonId: raw.season.id,
          syncedAt: FieldValue.serverTimestamp(),
        });
        metadata.set(`seasons/${m.seasonId}`, {
          competition: code,
          startDate: raw.season.startDate,
          endDate: raw.season.endDate,
          providerId: raw.season.id,
        });
        metadata.set(`rounds/${m.roundId}`, {
          seasonId: m.seasonId,
          competition: code,
          stage: m.stage,
          matchday: m.matchday,
        });
        if (
          m.status === "FINISHED" &&
          (m.homeScore === null || m.awayScore === null)
        )
          console.warn(
            `Partido ${m.id}: sin marcador reglamentario fiable; no se puntúa.`,
          );
      }
      for (const [path, data] of metadata)
        batch.set(db.doc(path), data, { merge: true });
      await batch.commit();
    }
    console.log(`${code}: ${matches.length} partidos sincronizados.`);
  }
  await recompute();
}
async function recompute() {
  // Cache calendars across groups. Only changed rounds require prediction reads.
  const cache = new Map<string, Match[]>();
  const groups = await db.collection("groups").get();
  for (const group of groups.docs) {
    const seasons = await group.ref.collection("gameSeasons").get();
    for (const season of seasons.docs) {
      const config = season.data();
      const mode = config.mode as Mode;
      if (!["classic", "exact"].includes(mode))
        throw new Error("Modalidad no válida en backend.");
      const members = group.data().memberIds as string[];
      if (!cache.has(config.seasonId)) {
        const fixtures = await db
          .collection("matches")
          .where("seasonId", "==", config.seasonId)
          .get();
        cache.set(
          config.seasonId,
          fixtures.docs.map((d) => d.data() as Match),
        );
      }
      const fixtures = cache.get(config.seasonId)!;
      const byRound = new Map<string, Match[]>();
      for (const match of fixtures) {
        const list = byRound.get(match.roundId) || [];
        list.push(match);
        byRound.set(match.roundId, list);
      }
      const previous = await season.ref.collection("standings").get();
      const totals = new Map<string, Standing>();
      for (const uid of members) {
        const row = previous.docs.find((d) => d.id === uid);
        totals.set(uid, sumRounds(row?.data().rounds || {}));
      }
      const membershipChanged =
        previous.docs
          .map((d) => d.id)
          .sort()
          .join(",") !== [...members].sort().join(",");
      const state: Record<string, string> = { ...config.scoringState };
      // An empty/moved/corrected round must clear its previous contribution as well.
      const roundIds = new Set([...byRound.keys(), ...Object.keys(state)]);
      let dirty = false;
      for (const rid of roundIds) {
        const games = byRound.get(rid) || [];
        const fingerprint = resultFingerprint(games);
        if (
          state[rid] === fingerprint &&
          config.scoringVersion === 1 &&
          !membershipChanged
        )
          continue;
        const finished = games.filter(
          (m) =>
            m.status === "FINISHED" &&
            m.homeScore !== null &&
            m.awayScore !== null,
        );
        const predictions = finished.length
          ? await season.ref
              .collection("predictions")
              .where("roundId", "==", rid)
              .get()
          : null;
        const roundTotals = scoreRound(
          mode,
          games,
          predictions?.docs.map((d) => d.data() as StoredPrediction) || [],
          members,
        );
        for (const [uid, total] of totals) {
          total.rounds[rid] = roundTotals.get(uid) || { points: 0, hits: 0 };
        }
        state[rid] = fingerprint;
        dirty = true;
      }
      // Membership changes recalculate historical rounds, including returning players.
      const previousMembers = previous.docs
        .map((d) => d.id)
        .sort()
        .join(",");
      if (!dirty && previousMembers === [...members].sort().join(",")) continue;
      const batch = db.batch();
      for (const row of previous.docs)
        if (!totals.has(row.id)) batch.delete(row.ref);
      for (const [uid, total] of totals) {
        const profile = await db.doc(`users/${uid}`).get();
        batch.set(season.ref.collection("standings").doc(uid), {
          ...sumRounds(total.rounds),
          name: profile.data()?.name || "Jugador",
          competition: config.competition,
          computedAt: FieldValue.serverTimestamp(),
        });
      }
      batch.update(season.ref, { scoringState: state, scoringVersion: 1 });
      // The round state and replacement totals commit atomically; never increment points.
      await batch.commit();
      console.log(`Clasificación actualizada: ${group.id}/${season.id}`);
    }
  }
}
await sync();
