import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AgentTracePanel } from "../components/agent/AgentTracePanel";
import { DrugGrid } from "../components/drug/DrugGrid";
import { DosageCard } from "../components/dosage/DosageCard";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { useStore } from "../lib/store";
import { streamAgentRun } from "../lib/agentStream";
import { normalizeDose, normalizeRecipe } from "../lib/utils";
import {
  getQuarantined,
  getRationale,
  getSubtype,
  tryGetRecommendations,
} from "../lib/analyzeContract";
import type { TraceEvent } from "../types/agent";

export function PetAnalyze() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const pets = useStore((s) => s.pets);
  const activeRun = useStore((s) => s.activeRun);
  const startRun = useStore((s) => s.startRun);
  const setRunningNode = useStore((s) => s.setRunningNode);
  const appendTrace = useStore((s) => s.appendTrace);
  const completeRun = useStore((s) => s.completeRun);
  const failRun = useStore((s) => s.failRun);
  const resetRun = useStore((s) => s.resetRun);

  const pet = pets.find((p) => p.id === id);

  if (!pet) return <div className="text-gray-500">Patient not found.</div>;

  const isRunning = activeRun.status === "running";
  const isComplete = activeRun.status === "complete";
  const result = activeRun.result;

  const recommendations = result ? tryGetRecommendations(result) : [];
  const quarantined = result
    ? (() => {
        try {
          return getQuarantined(result);
        } catch {
          return [];
        }
      })()
    : [];
  const subtype = result ? getSubtype(result) : null;
  const rationale = result
    ? (() => {
        try {
          return getRationale(result);
        } catch {
          return null;
        }
      })()
    : null;

  const normalizedDoses = (result?.dosages ?? []).map((d) => normalizeDose(d));
  const normalizedRecipe = result?.recipe
    ? normalizeRecipe(result.recipe, {
        pet_name: pet.name,
        breed: pet.breed,
        weight_kg: pet.weight_kg,
        prescribing_vet: pet.prescribing_vet ?? "Unknown",
      })
    : null;

  const handleRun = async () => {
    const token = await getToken();
    const body = {
      pet_name: pet.name,
      breed: pet.breed,
      weight_kg: pet.weight_kg,
      braf_status: pet.braf_status,
      msh2_loss: pet.msh2_loss,
      prescribing_vet: pet.prescribing_vet ?? "Unknown",
      creatinine_mg_dl: pet.creatinine_mg_dl ?? null,
      alt_u_l: pet.alt_u_l ?? null,
      expr: {},
    };

    await streamAgentRun(body, token, {
      onPipelineStart: (nodes) => startRun(pet.id, nodes),
      onNodeStart: (node) => setRunningNode(node),
      onNodeComplete: (event) => appendTrace(event as unknown as TraceEvent),
      onComplete: (res) => completeRun(res),
      onError: (err) => failRun(err),
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Analysis</h1>
          <p className="text-gray-500 mt-1">
            {pet.name} · {pet.breed} · {pet.weight_kg} kg
          </p>
        </div>
        <div className="flex gap-2">
          {(isComplete || activeRun.status === "error") && (
            <Button variant="outline" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={resetRun}>
              Reset
            </Button>
          )}
          <Button
            icon={<Play className="h-4 w-4" />}
            loading={isRunning}
            disabled={isRunning}
            onClick={handleRun}
          >
            {isRunning ? "Running..." : isComplete ? "Re-run" : "Run Agent"}
          </Button>
        </div>
      </div>

      <AgentTracePanel />

      {isComplete && result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-900">{subtype}</h2>
            </div>
            {rationale && (
              <p className="text-sm text-gray-700 leading-relaxed">{rationale}</p>
            )}
          </div>

          {recommendations.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Drug Recommendations</h2>
              <DrugGrid drugs={recommendations} quarantine={quarantined} />
            </div>
          )}

          {normalizedDoses.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Dosage Panel</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {normalizedDoses.map((dose) => (
                  <DosageCard key={dose.drug} dose={dose} />
                ))}
              </div>
            </div>
          )}

          {normalizedRecipe && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Prescription Recipe</h2>
              <RecipeCard recipe={normalizedRecipe} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
