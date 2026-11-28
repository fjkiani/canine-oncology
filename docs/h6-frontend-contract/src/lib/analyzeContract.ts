/**
 * H6 analyze UI contract — reads only H1/H5 backend fields.
 *
 * These helpers are what PetAnalyze / ranking / recipe views must use.
 * They intentionally do NOT fall back to v1 names (`ranked_drugs`, `fit_score`,
 * `quarantine_drugs`). Tests prove fixtures that only carry old fields fail.
 */
import type { DrugRecommendation, PharmacistDrugEntry, RecipeCardFull } from "../types/api";
import type { AgentRunResult } from "../types/agent";

export const PANEL_SIZE = 7;

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

/** Score used by DrugRankingCard — must be H1 `score`, never `fit_score`. */
export function getDrugScore(drug: DrugRecommendation | Record<string, unknown>): number {
  const rec = drug as Record<string, unknown>;
  if (typeof rec.score === "number") {
    return rec.score;
  }
  if (typeof rec.fit_score === "number") {
    throw new ContractError("DrugRecommendation.fit_score is legacy; use score (H1)");
  }
  throw new ContractError("DrugRecommendation.score missing");
}

/**
 * Recommendations from an agent complete payload.
 * Requires `recommendations` array; does not read `ranked_drugs`.
 */
export function getRecommendations(
  result: AgentRunResult | Record<string, unknown> | null | undefined
): DrugRecommendation[] {
  if (!result || typeof result !== "object") {
    throw new ContractError("analyze result missing");
  }
  const raw = result as Record<string, unknown>;

  const recs = raw.recommendations;
  if (!Array.isArray(recs)) {
    if (Array.isArray(raw.ranked_drugs)) {
      throw new ContractError("found ranked_drugs but not recommendations — H1 contract broken");
    }
    const nested = raw.score_result;
    if (
      nested &&
      typeof nested === "object" &&
      Array.isArray((nested as Record<string, unknown>).ranked_drugs) &&
      !Array.isArray((nested as Record<string, unknown>).recommendations)
    ) {
      throw new ContractError("score_result.ranked_drugs is legacy; use recommendations");
    }
    throw new ContractError("recommendations missing on analyze result");
  }

  if (recs.length !== PANEL_SIZE) {
    throw new ContractError(
      `recommendations length must be ${PANEL_SIZE} (full DRUG_PANEL), got ${recs.length}`
    );
  }

  for (const drug of recs) {
    getDrugScore(drug as DrugRecommendation);
  }

  return recs as DrugRecommendation[];
}

/** H1: quarantined hide-list should be []. Never reads quarantine_drugs. */
export function getQuarantined(
  result: AgentRunResult | Record<string, unknown> | null | undefined
): DrugRecommendation[] {
  if (!result || typeof result !== "object") return [];
  const raw = result as Record<string, unknown>;

  if (!("quarantined" in raw) && Array.isArray(raw.quarantine_drugs)) {
    throw new ContractError("quarantine_drugs is legacy; use quarantined=[]");
  }

  const q = raw.quarantined;
  if (q == null) return [];
  if (!Array.isArray(q)) {
    throw new ContractError("quarantined must be an array");
  }
  return q as DrugRecommendation[];
}

const REQUIRED_PHARMACIST_FIELDS: (keyof PharmacistDrugEntry)[] = [
  "drug",
  "final_dose_mg",
  "dose_per_kg",
  "schedule",
  "route",
  "renal_adjustment",
  "hepatic_adjustment",
  "pk_status",
  "quantity_to_dispense",
  "beyond_use_date_days",
  "beyond_use_date",
  "storage",
  "preparation_notes",
  "label_text",
];

export function assertPharmacistDrugEntry(drug: unknown, index = 0): PharmacistDrugEntry {
  if (!drug || typeof drug !== "object") {
    throw new ContractError(`recipe.drugs[${index}] is not an object`);
  }
  const d = drug as Record<string, unknown>;
  for (const field of REQUIRED_PHARMACIST_FIELDS) {
    if (!(field in d) || d[field] === undefined) {
      throw new ContractError(`PharmacistDrugEntry missing field "${field}" at drugs[${index}]`);
    }
  }
  if (!("final_dose_mg" in d) && "dose_mg" in d) {
    throw new ContractError("legacy dose_mg without final_dose_mg");
  }
  if (!("schedule" in d) && "frequency" in d) {
    throw new ContractError("legacy frequency without schedule");
  }
  return d as unknown as PharmacistDrugEntry;
}

export function assertRecipeCard(
  recipe: RecipeCardFull | Record<string, unknown> | null | undefined
): RecipeCardFull {
  if (!recipe || typeof recipe !== "object") {
    throw new ContractError("recipe missing");
  }
  const drugs = (recipe as RecipeCardFull).drugs;
  if (!Array.isArray(drugs) || drugs.length === 0) {
    throw new ContractError("recipe.drugs must be a non-empty array");
  }
  drugs.forEach((d, i) => assertPharmacistDrugEntry(d, i));
  return recipe as RecipeCardFull;
}

export function getSubtype(result: AgentRunResult | Record<string, unknown>): string | null {
  const raw = result as Record<string, unknown>;
  if (typeof raw.subtype === "string") return raw.subtype;
  return null;
}

export function getRationale(result: AgentRunResult | Record<string, unknown>): string | null {
  const raw = result as Record<string, unknown>;
  if (typeof raw.rationale === "string") return raw.rationale;
  if (typeof raw.rationale_text === "string" && raw.rationale == null) {
    throw new ContractError("rationale_text is legacy on complete payload; use rationale");
  }
  return null;
}

/** True when a complete payload is readable under H1/H5 (for UI gating). */
export function tryGetRecommendations(
  result: AgentRunResult | Record<string, unknown> | null | undefined
): DrugRecommendation[] {
  try {
    return getRecommendations(result);
  } catch {
    return [];
  }
}
