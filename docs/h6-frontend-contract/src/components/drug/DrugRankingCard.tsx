import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Pill, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { DrugRecommendation, EvidenceTier } from "../../types/api";
import { getDrugScore } from "../../lib/analyzeContract";

const tierConfig: Record<EvidenceTier, { variant: "success" | "info" | "muted"; label: string }> = {
  A: { variant: "success", label: "Tier A" },
  B: { variant: "info", label: "Tier B" },
  C: { variant: "muted", label: "Tier C" },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : pct >= 30 ? "bg-yellow-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

function feasibilityVariant(
  v: string | null | undefined
): "success" | "warning" | "danger" | "muted" | "info" {
  if (v === "PASS") return "success";
  if (v === "CONDITIONAL") return "warning";
  if (v === "FAIL" || v === "QUARANTINED") return "danger";
  if (v === "INCOMPLETE_PK") return "info";
  return "muted";
}

interface DrugRankingCardProps {
  drug: DrugRecommendation;
  rank: number;
  onDose?: (drug: string) => void;
}

export function DrugRankingCard({ drug, rank, onDose }: DrugRankingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tierKey = (drug.evidence_tier ?? "C") as EvidenceTier;
  const tier = tierConfig[tierKey] ?? tierConfig.C;
  const score = getDrugScore(drug);
  const braf = (drug.braf_requirement ?? "").toLowerCase();

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600">
            #{rank}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 capitalize">{drug.drug}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant={tier.variant}>{tier.label}</Badge>
              {drug.feasibility_verdict && (
                <Badge variant={feasibilityVariant(drug.feasibility_verdict)}>
                  {drug.feasibility_verdict}
                </Badge>
              )}
              {drug.pk_status && (
                <Badge variant={drug.pk_status === "VERIFIED" ? "success" : "muted"}>
                  {drug.pk_status}
                </Badge>
              )}
              {braf.includes("required") && <Badge variant="warning">BRAF required</Badge>}
              {braf.includes("prefer") && !braf.includes("required") && (
                <Badge variant="outline">BRAF preferred</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDose && (
            <Button size="sm" variant="outline" icon={<Pill className="h-3 w-3" />} onClick={() => onDose(drug.drug)}>
              Dose
            </Button>
          )}
          <button onClick={() => setExpanded((e) => !e)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Score</span>
          {drug.orr != null && <span>ORR {drug.orr}</span>}
        </div>
        <ScoreBar score={score} />
      </div>

      {drug.targets?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {drug.targets.map((t) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
              {t}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          {drug.mechanism && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Mechanism</p>
              <p className="text-sm text-gray-700">{drug.mechanism}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Scoring Rationale</p>
            <p className="text-sm text-gray-700">{drug.rationale}</p>
          </div>
          {drug.gap_ratio != null && (
            <p className="text-xs text-gray-500">Gap ratio: {drug.gap_ratio}</p>
          )}
        </div>
      )}
    </div>
  );
}
