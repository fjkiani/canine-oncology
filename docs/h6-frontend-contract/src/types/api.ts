/**
 * VetOnco API types — aligned with H1 full-panel score + H5 PharmacistDrugEntry.
 * Frozen: do not invent dosing math here. Numeric values come from the backend.
 */

export type FeasibilityVerdict =
  | "PASS"
  | "CONDITIONAL"
  | "FAIL"
  | "INCOMPLETE_PK"
  | "QUARANTINED";

export type PkStatus = "VERIFIED" | "QUARANTINED" | "UNVERIFIED";

export type EvidenceTier = "A" | "B" | "C";

/** Backend `services.tcc_scorer.DrugRecommendation` (H1). */
export interface DrugRecommendation {
  drug: string;
  score: number;
  rank: number;
  mechanism: string;
  targets: string[];
  braf_requirement: string;
  verdict: string;
  quarantined: boolean;
  rationale: string;
  evidence_tier: EvidenceTier;
  pk_status: PkStatus | string;
  feasibility_verdict: FeasibilityVerdict | string | null;
  gap_ratio: number | null;
  orr: number | null;
  orr_source: string | null;
  quarantine_reason: string | null;
}

/** Backend `services.tcc_scorer.TCCResult` score payload fields used by UI. */
export interface TCCScoreResult {
  subtype: string;
  braf_probability: number;
  recommendations: DrugRecommendation[];
  quarantined: DrugRecommendation[];
  summary?: string;
}

/** Alias used by agent types. */
export type TCCResult = TCCScoreResult;

/** Backend `services.recipe_generator.PharmacistDrugEntry` (H5). */
export interface PharmacistDrugEntry {
  drug: string;
  final_dose_mg: number;
  dose_per_kg: number;
  schedule: string;
  route: string;
  renal_adjustment: string;
  hepatic_adjustment: string;
  warnings: string[];
  notes: string;
  pk_status: PkStatus | string;
  orr_source: string | null;
  concentration_mg_ml: number | null;
  vehicle: string | null;
  quantity_to_dispense: string;
  beyond_use_date_days: number;
  beyond_use_date: string;
  storage: string;
  preparation_notes: string;
  label_text: string;
}

/** Full `/tcc/recipe` card; pipeline `recipe` may omit identity fields. */
export interface RecipeCardFull {
  pet_name: string;
  species: string;
  breed: string;
  weight_kg: number;
  bsa_m2: number;
  prescribing_vet: string;
  rx_number: string;
  date_issued: string;
  label_text: string;
  pdf_b64: string | null;
  drugs: PharmacistDrugEntry[];
  interactions: string[];
  monitoring: string[];
  printable_text: string;
}

export type RecipeDrug = PharmacistDrugEntry;
export type RecipeCard = RecipeCardFull;

/** Backend `services.tcc_dosing.DoseResult`. */
export interface DoseResult {
  drug: string;
  weight_kg: number;
  bsa_m2: number | null;
  dose_mg: number;
  dose_per_kg: number;
  schedule: string;
  route: string;
  renal_adjustment: string;
  hepatic_adjustment: string;
  final_dose_mg: number;
  notes: string;
  warnings: string[];
}

/** UI view of ChEMBL enrichment (maps backend CompoundData.name → drug). */
export interface CompoundData {
  drug: string;
  chembl_id: string;
  mw: number | null;
  ic50_nm: number | null;
  cmax_nm: number | null;
  gap_ratio: number | null;
  achievability: "ACHIEVABLE" | "MARGINAL" | "UNACHIEVABLE" | "UNKNOWN";
  smiles: string | null;
  mechanism?: string | null;
  targets?: string[];
}

/** Legacy alias — prefer CompoundData. */
export type CompoundEntry = CompoundData;

export interface TestAlert {
  parameter: string;
  value: number;
  grade: number;
  severity?: string;
  message?: string;
  action?: string;
}

export interface TestAnalysisResult {
  test_type: string;
  vcog_grades: Record<string, number>;
  alerts: TestAlert[];
  narrative: string;
}

export interface AgentStep {
  step: string;
  status: "ok" | "error" | "skipped";
  summary?: string;
  error?: string;
}
