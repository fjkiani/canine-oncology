import { DrugRankingCard } from "./DrugRankingCard";
import { Badge } from "../ui/Badge";
import type { DrugRecommendation } from "../../types/api";

interface DrugGridProps {
  drugs: DrugRecommendation[];
  /** H1: should be empty. Shown only if backend still returns rows. */
  quarantine?: DrugRecommendation[];
  onDose?: (drug: string) => void;
}

export function DrugGrid({ drugs, quarantine = [], onDose }: DrugGridProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {drugs.map((drug) => (
          <DrugRankingCard key={drug.drug} drug={drug} rank={drug.rank} onDose={onDose} />
        ))}
      </div>

      {quarantine.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="warning">NOTE</Badge>
            <span className="text-sm font-medium text-amber-900">Quarantined list (unexpected under H1)</span>
          </div>
          <p className="text-xs text-amber-800 mb-2">
            H1 full-panel score expects quarantined=[]. These rows were returned separately.
          </p>
          <div className="flex flex-wrap gap-2">
            {quarantine.map((d) => (
              <span
                key={d.drug}
                className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded capitalize"
              >
                {d.drug}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
