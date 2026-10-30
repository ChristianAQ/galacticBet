import { Layers } from "lucide-react";
import {
  COMPETITION_CODES,
  competitionName,
  type CompetitionCode,
} from "../lib/competitions";
import CompetitionLogo from "./CompetitionLogo";

export default function CompetitionTabs({
  value,
  onChange,
  available,
  onAll,
}: {
  value: CompetitionCode | "global";
  onChange: (value: CompetitionCode) => void;
  available?: readonly CompetitionCode[];
  onAll?: () => void;
}) {
  return (
    <div className="competition-tabs" role="group" aria-label="Competición">
      {onAll && (
        <button
          type="button"
          aria-pressed={value === "global"}
          onClick={onAll}
        >
          <span className="competition-tabs-all" aria-hidden="true">
            <Layers size={15} />
          </span>
          <span>Todas</span>
        </button>
      )}
      {COMPETITION_CODES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={value === code}
          disabled={available ? !available.includes(code) : false}
          onClick={() => onChange(code)}
        >
          <CompetitionLogo code={code} small />
          <span>{competitionName(code, true)}</span>
        </button>
      ))}
    </div>
  );
}
