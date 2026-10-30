import { ArrowRight, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMPETITION_CODES,
  competitionName,
  type CompetitionCode,
} from "../lib/competitions";
import {
  getCachedGroupRankings,
  loadGroupRankings,
  type Group,
} from "../lib/data";
import { matchStatusLabel, type Match } from "../lib/domain";
import {
  liveMatches,
  recentResults,
  type OpenRound,
} from "../lib/homeDashboard";
import { currentLeagueTable, LEAGUE_STAGES } from "../lib/leagueTable";
import { hasRegulationResult } from "../lib/matchInsights";
import { countdownLabel } from "../lib/matchPreview";
import { preferenceStore, resolveSelectedGroup } from "../lib/preferences";
import { buildRanking, rankingSummary } from "../lib/rankings";
import { roundDateRange } from "../lib/roundOptions";
import { usePreferences } from "../lib/useGroupSelection";
import CompetitionLogo from "./CompetitionLogo";
import { RankAvatar, RankBadge } from "./RankingWidgets";
import { readableError } from "./ui";

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});

function Crest({ src }: { src?: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <span className="crest-placeholder" aria-hidden="true" />
  );
}

export function QuinielaSpotlight({
  rounds,
  now,
  userId,
}: {
  rounds: OpenRound[];
  now: number;
  userId: string;
}) {
  const [main, ...others] = rounds;
  const pick = (competition: CompetitionCode) =>
    preferenceStore.update(userId, { competition });
  return (
    <section className="home-spotlight" aria-labelledby="spotlight-title">
      <span className="eyebrow">TU PRÓXIMA QUINIELA</span>
      {main ? (
        <>
          <div className="spotlight-main">
            <CompetitionLogo code={main.competition} />
            <div>
              <h2 id="spotlight-title">{main.label}</h2>
              <p>
                {competitionName(main.competition)} · {main.matches} partidos ·{" "}
                {roundDateRange(main.start, main.end)}
              </p>
            </div>
          </div>
          <p className="spotlight-countdown">
            <Timer size={16} aria-hidden="true" />
            Cierra en <strong>{countdownLabel(main.start, now)}</strong>
          </p>
          <Link
            className="button primary full spotlight-cta"
            to="/quiniela"
            onClick={() => pick(main.competition)}
          >
            Hacer mi quiniela <ArrowRight size={16} />
          </Link>
          {others.length > 0 && (
            <ul className="spotlight-more">
              {others.map((r) => (
                <li key={r.id}>
                  <Link to="/quiniela" onClick={() => pick(r.competition)}>
                    <CompetitionLogo code={r.competition} small />
                    <span>
                      <strong>{competitionName(r.competition, true)}</strong>
                      <small>{r.label}</small>
                    </span>
                    <small>Cierra en {countdownLabel(r.start, now)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <h2 id="spotlight-title">Sin jornadas abiertas</h2>
          <p className="spotlight-empty">
            Las próximas quinielas aparecerán en cuanto se publique el
            calendario.
          </p>
          <Link className="button secondary full" to="/partidos">
            Ver calendario <ArrowRight size={16} />
          </Link>
        </>
      )}
    </section>
  );
}

export function MatchTicker({ matches, now }: { matches: Match[]; now: number }) {
  const live = useMemo(() => liveMatches(matches), [matches]);
  const recent = useMemo(() => recentResults(matches, now), [matches, now]);
  const list = live.length ? live : recent;
  if (!list.length) return null;
  return (
    <section className="match-ticker" aria-labelledby="ticker-title">
      <div className="section-heading">
        <h2 id="ticker-title">
          {live.length ? (
            <>
              <i className="ticker-live" aria-hidden="true" /> En directo
            </>
          ) : (
            "Últimos resultados"
          )}
        </h2>
        <Link to="/partidos">
          Ver calendario <ArrowRight size={13} />
        </Link>
      </div>
      <ul className="ticker-list">
        {list.map((m) => {
          const scored = m.homeScore !== null && m.awayScore !== null;
          const winner =
            scored && m.homeScore !== m.awayScore
              ? m.homeScore! > m.awayScore!
                ? "home"
                : "away"
              : null;
          return (
            <li key={m.id}>
              <Link
                className="ticker-card"
                to={`/partidos?competition=${m.competition}&round=${encodeURIComponent(m.roundId)}`}
                aria-label={`${m.home} ${m.homeScore ?? ""} – ${m.awayScore ?? ""} ${m.away}`}
              >
                <small>
                  {competitionName(m.competition, true)} ·{" "}
                  {live.length
                    ? matchStatusLabel[m.status]
                    : shortDate.format(new Date(m.utcDate))}
                </small>
                {(["home", "away"] as const).map((side) => (
                  <span
                    key={side}
                    className={`ticker-team${winner === side ? " is-winner" : ""}`}
                  >
                    <Crest src={side === "home" ? m.homeCrest : m.awayCrest} />
                    <span>{m[side]}</span>
                    <b>{side === "home" ? m.homeScore ?? "–" : m.awayScore ?? "–"}</b>
                  </span>
                ))}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function GroupPulse({
  userId,
  groups,
}: {
  userId: string;
  groups: Group[];
}) {
  const preferences = usePreferences(userId);
  const groupId = resolveSelectedGroup(groups, null, preferences.groupId);
  const group = groups.find((g) => g.id === groupId);
  const key = group ? `${group.id}:${[...group.memberIds].sort().join(",")}` : "";
  const [state, setState] = useState<{
    key: string;
    data?: Awaited<ReturnType<typeof loadGroupRankings>>;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!group) return;
    let active = true;
    loadGroupRankings(group).then(
      (data) => {
        if (active) setState({ key, data });
      },
      (e: unknown) => {
        if (active) setState({ key, error: readableError(e) });
      },
    );
    return () => {
      active = false;
    };
  }, [key]);
  const data =
    state.key === key && state.data
      ? state.data
      : group
        ? getCachedGroupRankings(group)
        : undefined;
  const error = state.key === key ? state.error : undefined;
  const rows = useMemo(
    () =>
      data
        ? buildRanking(data.participants, data.seasons, preferences.competition)
        : [],
    [data, preferences.competition],
  );
  if (!group) return null;
  const summary = rankingSummary(rows, userId);
  const visible = rows.slice(0, 3);
  if (summary.me && !visible.includes(summary.me)) visible.push(summary.me);
  return (
    <section className="group-pulse panel" aria-labelledby="pulse-title">
      <header>
        <div>
          <span className="eyebrow">TU GRUPO</span>
          <h3 id="pulse-title">{group.name}</h3>
          <small>{competitionName(preferences.competition)} · Total</small>
        </div>
        <Trophy size={20} aria-hidden="true" />
      </header>
      {error ? (
        <p className="pulse-empty" role="status">
          {error}
        </p>
      ) : !data ? (
        <div className="pulse-skeleton" role="status" aria-label="Cargando">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          {summary.me && (
            <p className="pulse-me">
              <strong>{summary.me.position}º</strong>
              <span>
                de {summary.total} ·{" "}
                {summary.me.position === 1
                  ? "lideras el grupo"
                  : `a ${summary.gapToLeader} pts del líder`}
              </span>
            </p>
          )}
          <ol className="pulse-list">
            {visible.map((r) => (
              <li key={r.id} className={r.id === userId ? "is-me" : undefined}>
                <RankBadge position={r.position} />
                <RankAvatar name={r.name} avatar={r.avatar} />
                <span>
                  {r.name}
                  {r.id === userId && <small> Tú</small>}
                </span>
                <strong>{r.points}</strong>
              </li>
            ))}
          </ol>
        </>
      )}
      <Link to="/clasificacion" className="pulse-link">
        Ver clasificación completa <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export function LeagueTableCard({
  matches,
  now,
}: {
  matches: Match[];
  now: number;
}) {
  const available = useMemo(
    () =>
      COMPETITION_CODES.filter((code) =>
        matches.some(
          (m) =>
            m.competition === code &&
            LEAGUE_STAGES.includes(m.stage) &&
            hasRegulationResult(m),
        ),
      ),
    [matches],
  );
  const [selected, setSelected] = useState<CompetitionCode>("PD");
  const code = available.find((c) => c === selected) ?? available[0];
  const rows = useMemo(
    () => (code ? currentLeagueTable(matches, code, now).slice(0, 6) : []),
    [matches, code, now],
  );
  if (!code) return null;
  return (
    <section className="league-card panel" aria-labelledby="league-title">
      <header>
        <h3 id="league-title">Clasificación</h3>
        {available.length > 1 && (
          <div className="league-tabs" role="group" aria-label="Competición">
            {available.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === code}
                onClick={() => setSelected(c)}
              >
                {competitionName(c, true)}
              </button>
            ))}
          </div>
        )}
      </header>
      <table className="league-mini">
        <caption className="sr-only">
          Clasificación de {competitionName(code)}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Equipo</th>
            <th scope="col" title="Partidos jugados">
              PJ
            </th>
            <th scope="col" title="Diferencia de goles">
              DG
            </th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const diff = r.goalsFor - r.goalsAgainst;
            return (
              <tr key={r.key}>
                <td>{i + 1}</td>
                <th scope="row">
                  <span className="league-team">
                    <Crest src={r.crest} />
                    <span>{r.name}</span>
                  </span>
                </th>
                <td>{r.played}</td>
                <td>{diff > 0 ? `+${diff}` : diff}</td>
                <td>
                  <strong>{r.points}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="league-note">Calculada con los resultados sincronizados.</p>
    </section>
  );
}
