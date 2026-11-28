import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CompoundData, DoseResult, PharmacistDrugEntry, RecipeCard } from "../types/api";
import { assertPharmacistDrugEntry } from "./analyzeContract";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDate(ts: number | string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function computeBSA(weight_kg: number): number {
  return parseFloat((0.101 * Math.pow(weight_kg, 0.667)).toFixed(3));
}

/**
 * Map backend ChEMBL CompoundData (`name`, `achievable`) → UI CompoundData.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCompound(raw: any): CompoundData {
  let achievability: CompoundData["achievability"] = "UNKNOWN";
  if (typeof raw.achievability === "string" && raw.achievability) {
    achievability = raw.achievability as CompoundData["achievability"];
  } else if (raw.achievable === true) {
    achievability = "ACHIEVABLE";
  } else if (raw.achievable === false) {
    achievability = raw.gap_ratio != null && raw.gap_ratio < 0.5 ? "MARGINAL" : "UNACHIEVABLE";
  }

  return {
    drug: raw.name ?? raw.drug ?? "unknown",
    chembl_id: raw.chembl_id ?? "",
    mw: raw.mw ?? null,
    ic50_nm: raw.ic50_nm ?? null,
    cmax_nm: raw.cmax_nm ?? null,
    gap_ratio: raw.gap_ratio ?? null,
    achievability,
    smiles: raw.smiles ?? null,
    mechanism: raw.mechanism ?? null,
    targets: raw.targets ?? [],
  };
}

/**
 * Normalize backend DoseResult — preserve H1 dosing fields (no frequency/hold invent).
 * HOLD is derived from renal/hepatic adjustment or zero final dose.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDose(raw: any): DoseResult {
  const finalDose = Number(raw.final_dose_mg ?? raw.dose_mg ?? 0);
  const renal = String(raw.renal_adjustment ?? "none");
  const hepatic = String(raw.hepatic_adjustment ?? "none");
  const warnings: string[] = Array.isArray(raw.warnings) ? [...raw.warnings] : [];

  return {
    drug: raw.drug ?? "unknown",
    weight_kg: Number(raw.weight_kg ?? 0),
    bsa_m2: raw.bsa_m2 ?? null,
    dose_mg: Number(raw.dose_mg ?? finalDose),
    dose_per_kg: Number(
      raw.dose_per_kg ??
        (finalDose && raw.weight_kg ? finalDose / Number(raw.weight_kg) : 0)
    ),
    schedule: raw.schedule ?? "—",
    route: raw.route ?? "oral",
    renal_adjustment: renal,
    hepatic_adjustment: hepatic,
    final_dose_mg: finalDose,
    notes: raw.notes ?? "",
    warnings,
  };
}

export function doseIsHeld(dose: DoseResult): boolean {
  return (
    dose.final_dose_mg === 0 ||
    dose.renal_adjustment === "hold" ||
    dose.hepatic_adjustment === "hold"
  );
}

/**
 * Normalize recipe to RecipeCardFull while preserving PharmacistDrugEntry fields.
 * Pipeline recipe may omit identity — fill from context; never strip H5 drug fields.
 */
export function normalizeRecipe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  ctx?: {
    pet_name?: string;
    breed?: string;
    weight_kg?: number;
    prescribing_vet?: string;
  }
): RecipeCard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drugs: PharmacistDrugEntry[] = (raw.drugs ?? []).map((d: any, i: number) => {
    // Reject v1-only keys — do not silently remap dose_mg/frequency as H5
    if (d?.final_dose_mg == null && d?.dose_mg != null) {
      throw new Error(`legacy dose_mg without final_dose_mg at drugs[${i}]`);
    }
    if (d?.schedule == null && d?.frequency != null) {
      throw new Error(`legacy frequency without schedule at drugs[${i}]`);
    }

    const entry: PharmacistDrugEntry = {
      drug: d.drug ?? "unknown",
      final_dose_mg: Number(d.final_dose_mg ?? 0),
      dose_per_kg: Number(d.dose_per_kg ?? 0),
      schedule: d.schedule ?? "—",
      route: d.route ?? "oral",
      renal_adjustment: d.renal_adjustment ?? "none",
      hepatic_adjustment: d.hepatic_adjustment ?? "none",
      warnings: Array.isArray(d.warnings) ? d.warnings : [],
      notes: d.notes ?? "",
      pk_status: d.pk_status ?? "UNVERIFIED",
      orr_source: d.orr_source ?? null,
      concentration_mg_ml: d.concentration_mg_ml ?? null,
      vehicle: d.vehicle ?? null,
      quantity_to_dispense: d.quantity_to_dispense ?? "Quantity per prescriber",
      beyond_use_date_days: Number(d.beyond_use_date_days ?? 0),
      beyond_use_date: d.beyond_use_date ?? "",
      storage: d.storage ?? "",
      preparation_notes: d.preparation_notes ?? "",
      label_text: d.label_text ?? "",
    };
    assertPharmacistDrugEntry(entry, i);
    return entry;
  });

  return {
    pet_name: raw.pet_name ?? ctx?.pet_name ?? "",
    species: raw.species ?? "Canis lupus familiaris",
    breed: raw.breed ?? ctx?.breed ?? "",
    weight_kg: Number(raw.weight_kg ?? ctx?.weight_kg ?? 0),
    bsa_m2: Number(raw.bsa_m2 ?? 0),
    prescribing_vet: raw.prescribing_vet ?? ctx?.prescribing_vet ?? "VetOnco System",
    rx_number: raw.rx_number ?? "—",
    date_issued: raw.date_issued ?? new Date().toISOString().slice(0, 10),
    label_text: raw.label_text ?? "",
    pdf_b64: raw.pdf_b64 ?? null,
    drugs,
    interactions: raw.interactions ?? [],
    monitoring: raw.monitoring ?? [],
    printable_text: raw.printable_text ?? "",
  };
}
