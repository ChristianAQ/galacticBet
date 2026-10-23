import type { DocumentReference } from "firebase-admin/firestore";
import type { Match, Mode } from "../src/lib/domain";
import {
  encodeDelivery,
  roundRequirements,
  validDeliveredPicks,
} from "../src/lib/roundDelivery";

// One pass per existing member. Historical scores stay intact; only complete,
// already immutable submissions become eligible for reciprocal sharing.
export async function migrateSubmissions(
  season: DocumentReference,
  members: string[],
  fixtures: Match[],
  mode: Mode,
) {
  for (const uid of members) {
    const markers = await season
      .collection("submissions")
      .doc(uid)
      .collection("rounds")
      .get();
    const legacy = markers.docs.filter((doc) => doc.data().formatVersion !== 2);
    if (!legacy.length) continue;
    const predictions = await season
      .collection("predictions")
      .where("userId", "==", uid)
      .get();
    for (const marker of legacy) {
      const rid = marker.id;
      const { matchIds } = roundRequirements(
        fixtures.filter((m) => m.roundId === rid),
      );
      const picks = Object.fromEntries(
        predictions.docs
          .map((doc) => doc.data())
          .filter((p) => p.roundId === rid && matchIds.includes(p.matchId))
          .map((p) => [p.matchId, p.value]),
      );
      const submittedAt = marker.data().submittedAt;
      if (!validDeliveredPicks(mode, matchIds, picks) || !submittedAt?.toMillis)
        continue;
      const batch = season.firestore.batch();
      batch.set(
        season
          .collection("roundEntries")
          .doc(rid)
          .collection("players")
          .doc(uid),
        {
          userId: uid,
          roundId: rid,
          submittedAt,
          formatVersion: 2,
          ...encodeDelivery(mode, matchIds, picks),
        },
      );
      batch.update(marker.ref, { formatVersion: 2 });
      batch.set(
        season.collection("roundAttendance").doc(rid),
        { members: { [uid]: submittedAt } },
        { merge: true },
      );
      await batch.commit();
    }
  }
}
