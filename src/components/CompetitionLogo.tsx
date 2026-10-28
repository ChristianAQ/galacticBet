import {
  competitionName,
  competitionCode,
  COMPETITIONS,
} from "../lib/competitions";
import { useState } from "react";
/** Identical light badges keep all three official emblems legible on dark surfaces. */
export default function CompetitionLogo({
  code,
  small = false,
}: {
  code: string;
  small?: boolean;
}) {
  const [loadedCode, setLoadedCode] = useState("");
  const loaded = loadedCode === code;
  return (
    <span
      className={`competition-logo competition-badge ${small ? "small" : ""}`}
      role="img"
      aria-label={competitionName(code)}
    >
      <img
        className={`official-emblem ${loaded ? "loaded" : ""}`}
        src={`https://crests.football-data.org/${code}.png`}
        alt=""
        onLoad={() => setLoadedCode(code)}
        onError={() => setLoadedCode("")}
      />
      {!loaded && (
        <span className="competition-fallback" aria-hidden="true">
          {COMPETITIONS[competitionCode(code)].mark}
        </span>
      )}
    </span>
  );
}
