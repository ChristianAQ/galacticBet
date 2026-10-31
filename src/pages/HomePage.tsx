import { useEffect, useMemo, useState } from "react";
import UpcomingSchedule from "../components/UpcomingSchedule";
import NewsSection from "../components/NewsSection";
import { MatchTicker, QuinielaSpotlight } from "../components/HomeWidgets";
import type { Match } from "../lib/domain";
import { openRounds } from "../lib/homeDashboard";
import { upcomingMatches } from "../lib/schedule";

export default function HomePage({
  userId,
  matches,
  loading,
  demo = false,
}: {
  userId: string;
  matches: Match[];
  loading: boolean;
  demo?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const upcoming = useMemo(() => upcomingMatches(matches, now), [matches, now]);
  const rounds = useMemo(() => openRounds(matches, now), [matches, now]);
  return (
    <>
      <h1 className="sr-only">Inicio</h1>
      <div className="home-top-grid">
        {!loading && (
          <QuinielaSpotlight rounds={rounds} now={now} userId={userId} />
        )}
        <UpcomingSchedule
          matches={matches}
          upcoming={upcoming}
          now={now}
          loading={loading}
        />
      </div>
      {!loading && <MatchTicker matches={matches} now={now} />}
      <NewsSection demo={demo} />
    </>
  );
}
