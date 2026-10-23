import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Match, Mode } from "../src/lib/domain";
import { scoringCalendar } from "./calendarSync";
import {
  resultFingerprint,
  scoreRound,
  sumRounds,
  type Standing,
  type StoredPrediction,
} from "./standings";
export async function recompute(db: Firestore, cache: Map<string, Match[]>) {
  // Current calendars come directly from the API; archived snapshots cost one read per season.
  const profiles = new Map<string, string>();
  const groups = await db.collection("groups").get();
  for (const group of groups.docs) {
    const seasons = await group.ref.collection("gameSeasons").get();
    for (const season of seasons.docs) {
      const config = season.data();
      const mode = config.mode as Mode;
      if (!["classic", "exact"].includes(mode))
        throw new Error("Modalidad no válida en backend.");
      const members = group.data().memberIds as string[];
      const fixtures = await scoringCalendar(db, config.seasonId, cache);
      const byRound = new Map<string, Match[]>();
      for (const match of fixtures) {
        const list = byRound.get(match.roundId) || [];
        list.push(match);
        byRound.set(match.roundId, list);
      }
      const membershipChanged =
        !Array.isArray(config.scoringMembers) ||
        [...config.scoringMembers].sort().join(",") !==
          [...members].sort().join(",");
      const state: Record<string, string> = { ...config.scoringState };
      // An empty/moved/corrected round must clear its previous contribution as well.
      const roundIds = new Set([...byRound.keys(), ...Object.keys(state)]);
      const changedRounds = [...roundIds].filter(
        (rid) =>
          state[rid] !== resultFingerprint(byRound.get(rid) || []) ||
          config.scoringVersion !== 1 ||
          membershipChanged,
      );
      // Nothing to score: do not read standings, profiles or forecasts at all.
      if (!changedRounds.length && !membershipChanged) continue;
      const previous = await season.ref.collection("standings").get();
      const totals = new Map<string, Standing>();
      for (const uid of members) {
        const row = previous.docs.find((d) => d.id === uid);
        totals.set(uid, sumRounds(row?.data().rounds || {}));
      }
      for (const rid of changedRounds) {
        const games = byRound.get(rid) || [];
        const fingerprint = resultFingerprint(games);
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
      }
      const batch = db.batch();
      for (const row of previous.docs)
        if (!totals.has(row.id)) batch.delete(row.ref);
      for (const [uid, total] of totals) {
        if (!profiles.has(uid)) {
          const profile = await db.doc(`users/${uid}`).get();
          profiles.set(uid, profile.data()?.name || "Jugador");
        }
        batch.set(season.ref.collection("standings").doc(uid), {
          ...sumRounds(total.rounds),
          name: profiles.get(uid),
          competition: config.competition,
          computedAt: FieldValue.serverTimestamp(),
        });
      }
      batch.update(season.ref, {
        scoringState: state,
        scoringVersion: 1,
        scoringMembers: [...members].sort(),
      });
      // The round state and replacement totals commit atomically; never increment points.
      await batch.commit();
      console.log(`Clasificación actualizada: ${group.id}/${season.id}`);
    }
  }
}
