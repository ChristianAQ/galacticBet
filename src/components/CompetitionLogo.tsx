import {
  competitionName,
  competitionCode,
  COMPETITIONS,
} from "../lib/competitions";
import { useState } from "react";
/** Public provider emblems; local wordmarks remain visible if the image is unavailable. */
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
      className={`competition-logo ${code === "PD" ? "laliga" : "champions"} ${small ? "small" : ""}`}
      role="img"
      aria-label={competitionName(code)}
    >
      {code !== "CDR" && (
        <img
          className={`official-emblem ${loaded ? "loaded" : ""}`}
          src={`https://crests.football-data.org/${code}.png`}
          alt=""
          onLoad={() => setLoadedCode(code)}
          onError={() => setLoadedCode("")}
        />
      )}
      {!loaded &&
        (code === "PL" || code === "CDR" ? (
          <span className="competition-monogram">
            {code === "CDR" ? "🏆" : COMPETITIONS[competitionCode(code)].mark}
          </span>
        ) : code === "CL" ? (
          <>
            <span className="starball">✦</span>
            <span>
              UEFA
              <br />
              CHAMPIONS
              <br />
              LEAGUE
            </span>
          </>
        ) : (
          <>
            <span className="ll-mark">LL</span>
            <strong>LALIGA</strong>
          </>
        ))}
    </span>
  );
}
