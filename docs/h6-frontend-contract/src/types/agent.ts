/**
 * Agent / SSE types — aligned with backend `build_pipeline_result` (H1+H5).
 */
import type {
  CompoundData,
  DoseResult,
  DrugRecommendation,
  RecipeCard,
  TCCResult,
  TestAnalysisResult,
} from "./api";

export type { CompoundData, DoseResult, DrugRecommendation, RecipeCard, TCCResult };

export interface TraceEvent {
  node: string;
  status: "running" | "ok" | "error" | "skipped";
  started_at: number;
  finished_at: number;
  duration_ms: number;
  summary: string;
  output_preview: Record<string, unknown>;
  error?: string | null;
}

/**
 * Final SSE `complete` payload from `/api/canine/agent/run`.
 * Flat H1/H5 shape — NOT nested `score_result.ranked_drugs`.
 */
export interface AgentRunResult {
  event?: "complete";
  pet_name: string;
  breed: string;
  braf_status: string;
  subtype: string | null;
  braf_probability: number | null;
  recommendations: DrugRecommendation[];
  quarantined: DrugRecommendation[];
  compounds: CompoundData[] | Record<string, unknown>[];
  dosages: DoseResult[];
  recipe: RecipeCard | Record<string, unknown> | null;
  rationale: string | null;
  pipeline_summary: string | null;
  trace: TraceEvent[];
  errors: string[];
  complete: boolean;
}

export interface MonitoringAlert {
  alert_id: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  parameter: string;
  trend: "worsening" | "improving" | "stable";
  message: string;
  action: string;
  drug_implicated?: string | null;
}

export interface MonitoringResult {
  pet_id: string;
  pet_name: string;
  trend_analysis: Record<
    string,
    {
      test_type: string;
      values: number[];
      slope: number;
      trend: string;
      latest: number;
      severity: string;
      n_readings: number;
    }
  >;
  alerts: MonitoringAlert[];
  monitoring_summary: string | null;
  trace: TraceEvent[];
  has_critical: boolean;
}

export interface TestSession {
  session_id: string;
  date: string;
  test_type: string;
  values: Record<string, number>;
  notes?: string;
  analysis?: TestAnalysisResult;
}
