import MatchMeta from "./MatchMeta";
import { competitionName } from "../lib/competitions";
import { CalendarDays } from "lucide-react";
import { matchStatusLabel, roundLabel, type Match } from "../lib/domain";
import { knockoutContext } from "../lib/matchInsights";
import CompetitionLogo from "./CompetitionLogo";
import Modal from "./Modal";
import MatchResult from "./MatchResult";
import MatchExtras from "./MatchExtras";
import MatchCalendarAction from "./MatchCalendarAction";
import { useMatchInsight } from "../lib/useMatchInsight";
import TeamForm from "./TeamForm";
import { Team } from "./ui";

export default function MatchDetails({
  match,
  matches,
  onClose,
  demo = false,
}: {
  match: Match;
  matches: Match[];
  onClose: () => void;
  demo?: boolean;
}) {
  const insights = useMatchInsight(match, demo);
  const context = knockoutContext(match, matches);
  const resultKnown = match.homeScore !== null && match.awayScore !== null;
  return (
    <Modal
      title="Ficha del partido"
      className="match-details-modal"
      onClose={onClose}
    >
      <div className="match-detail-competition">
        <CompetitionLogo code={match.competition} small />
        <span>
          <strong>{competitionName(match.competition)}</strong>
          <small>
            {roundLabel(match)}
            {context?.leg ? ` · ${context.leg === 1 ? "Ida" : "Vuelta"}` : ""}
          </small>
        </span>
      </div>
      <div className="match-detail-teams">
        <div>
          <Team name={match.home} crest={match.homeCrest} />
          <TeamForm match={match} side="home" matches={matches} />
        </div>
        <div className="match-detail-score">
          <strong>
            {resultKnown
              ? `${match.homeScore} – ${match.awayScore}`
              : match.status === "FINISHED"
                ? "—"
                : "vs"}
          </strong>
          <small>{matchStatusLabel[match.status] || match.status}</small>
          {resultKnown && <small>A 90 minutos</small>}
        </div>
        <div>
          <Team name={match.away} crest={match.awayCrest} />
          <TeamForm match={match} side="away" matches={matches} />
        </div>
      </div>
      <p className="match-local-date">
        <CalendarDays size={15} />
        <time dateTime={match.utcDate}>
          {new Intl.DateTimeFormat("es", {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(match.utcDate))}
        </time>
      </p>
      {!demo && <MatchMeta insight={insights.insight} />}
      {!demo && <MatchCalendarAction match={match} />}
      {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
        match.scoreDuration || "",
      ) && (
        <p className="match-context-note">
          {match.scoreDuration === "EXTRA_TIME"
            ? "Este partido se resolvió con prórroga."
            : "Este partido se resolvió en una tanda de penaltis."}{" "}
          Marcador mostrado a 90 minutos.
        </p>
      )}
      {match.status === "FINISHED" && (
        <MatchResult
          match={match}
          insight={insights.insight}
          loading={insights.loading}
          demo={demo}
        />
      )}
      <MatchExtras
        match={match}
        {...insights}
        demo={demo}
        hideStatistics={match.status === "FINISHED"}
      />
    </Modal>
  );
}
