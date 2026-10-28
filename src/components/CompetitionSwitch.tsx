import { competitionName } from "../lib/competitions";
import { COMPETITION_CODES } from "../lib/competitions";
import CompetitionLogo from "./CompetitionLogo";
import type { CompetitionCode } from "../lib/preferences";
export default function CompetitionSwitch({
  value,
  onChange,
  combined = false,
  disabled = false,
  available = [...COMPETITION_CODES],
}: {
  value: CompetitionCode;
  onChange: (value: CompetitionCode) => void;
  combined?: boolean;
  disabled?: boolean;
  available?: CompetitionCode[];
}) {
  return (
    <div
      className="competition-switch"
      data-competition={value}
      data-combined={combined}
      role="group"
      aria-label="Elegir competición"
    >
      {COMPETITION_CODES.map((code) => (
        <button
          key={code}
          type="button"
          aria-label={competitionName(code)}
          aria-pressed={!combined && value === code}
          disabled={disabled || !available.includes(code)}
          onClick={() => onChange(code)}
        >
          <CompetitionLogo code={code} small />
          <span>{competitionName(code, true)}</span>
        </button>
      ))}
    </div>
  );
}
