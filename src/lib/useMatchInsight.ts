import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Match } from "./domain";
import type { MatchInsight } from "./matchInsightsData";
import { createMatchInsightLoader } from "./matchInsightCache";

const load = createMatchInsightLoader(
  import.meta.env.VITE_FIREBASE_PROJECT_ID || "unconfigured",
  () => localStorage,
  async (id) => {
    if (!db) return null;
    const snapshot = await getDoc(doc(db, "matchInsights", id));
    return snapshot.data()?.insight ?? null;
  },
);

export function useMatchInsight(match: Match, demo = false) {
  const [attempt, setAttempt] = useState(0);
  const key = `${match.competition}:${match.id}:${match.utcDate}:${demo}`;
  const [state, setState] = useState<{
    key: string;
    insight: MatchInsight | null;
    loading: boolean;
    error: string;
  }>({
    key,
    insight: null,
    loading: !demo,
    error: "",
  });
  const { id, competition, utcDate } = match;
  useEffect(() => {
    let active = true;
    setState({ key, insight: null, loading: !demo, error: "" });
    if (!demo) {
      // All fixture metadata used by the loader is represented by the effect key.
      void load({ id, competition, utcDate }).then(
        (insight) => {
          if (active) setState({ key, insight, loading: false, error: "" });
        },
        () => {
          if (active)
            setState({
              key,
              insight: null,
              loading: false,
              error:
                "No se han podido cargar los detalles. Puedes volver a intentarlo.",
            });
        },
      );
    }
    return () => {
      active = false;
    };
  }, [key, id, competition, utcDate, demo, attempt]);
  const onRetry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = state.key === key;
  return {
    insight: current ? state.insight : null,
    loading: current ? state.loading : !demo,
    error: current ? state.error : "",
    onRetry,
  };
}
