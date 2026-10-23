import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { samePrediction, type PredictionValue } from "./domain";

/** Confirm the exact selections the player reviewed, then seal the whole round. */
export async function sealRound(
  store: Firestore,
  uid: string,
  groupId: string,
  seasonId: string,
  roundId: string,
  expected: Record<string, PredictionValue>,
) {
  if (!Object.keys(expected).length)
    throw new Error("Elige al menos un pronóstico antes de guardar.");
  const ref = doc(
    store,
    "groups",
    groupId,
    "gameSeasons",
    seasonId,
    "submissions",
    uid,
    "rounds",
    roundId,
  );
  await runTransaction(store, async (transaction) => {
    if ((await transaction.get(ref)).exists())
      throw new Error("Esta quiniela ya está guardada y cerrada.");
    const entries = Object.entries(expected);
    const snapshots = await Promise.all(
      entries.map(([matchId]) =>
        transaction.get(
          doc(
            store,
            "groups",
            groupId,
            "gameSeasons",
            seasonId,
            "predictions",
            `${uid}_${matchId}`,
          ),
        ),
      ),
    );
    for (let i = 0; i < entries.length; i++) {
      const data = snapshots[i].data();
      if (
        !data ||
        data.roundId !== roundId ||
        !samePrediction(data.value as PredictionValue, entries[i][1])
      ) {
        throw new Error(
          "Tus elecciones han cambiado en otro dispositivo. Revisa la quiniela antes de confirmarla.",
        );
      }
    }
    transaction.set(ref, {
      userId: uid,
      roundId,
      submittedAt: serverTimestamp(),
    });
  });
}
