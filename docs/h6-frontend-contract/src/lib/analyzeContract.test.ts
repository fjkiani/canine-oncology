import { describe, expect, it } from "vitest";
import {
  assertPharmacistDrugEntry,
  assertRecipeCard,
  ContractError,
  getDrugScore,
  getQuarantined,
  getRationale,
  getRecommendations,
  PANEL_SIZE,
} from "./analyzeContract";
import { normalizeRecipe } from "./utils";

const PANEL = [
  "toceranib",
  "mitoxantrone",
  "gemcitabine",
  "carboplatin",
  "trametinib",
  "piroxicam",
  "vinblastine",
] as const;

function h1Recommendation(drug: string, rank: number, score: number) {
  return {
    drug,
    score,
    rank,
    mechanism: "test",
    targets: ["KIT"],
    braf_requirement: "preferred",
    verdict: "PASS",
    quarantined: false,
    rationale: `${drug} rationale`,
    evidence_tier: "A" as const,
    pk_status: rank === 1 ? "VERIFIED" : "UNVERIFIED",
    feasibility_verdict: rank === 1 ? "PASS" : "INCOMPLETE_PK",
    gap_ratio: rank === 1 ? 0.6494 : null,
    orr: score,
    orr_source: null,
    quarantine_reason: null,
  };
}

function h1CompletePayload() {
  return {
    pet_name: "Angus",
    breed: "Scottish Terrier",
    braf_status: "positive",
    subtype: "BRAF-driven",
    braf_probability: 0.9,
    recommendations: PANEL.map((d, i) =>
      h1Recommendation(d, i + 1, [0.38, 0.35, 0.28, 0.266, 0.2, 0.18, 0.154][i])
    ),
    quarantined: [],
    compounds: [],
    dosages: [],
    recipe: {
      drugs: [
        {
          drug: "toceranib",
          final_dose_mg: 33.0,
          dose_per_kg: 2.75,
          schedule: "MWF",
          route: "oral",
          renal_adjustment: "none",
          hepatic_adjustment: "none",
          warnings: [],
          notes: "",
          pk_status: "VERIFIED",
          orr_source: "Bernabe",
          concentration_mg_ml: null,
          vehicle: null,
          quantity_to_dispense: "30 tablets",
          beyond_use_date_days: 90,
          beyond_use_date: "2026-12-01",
          storage: "room temp",
          preparation_notes: "none",
          label_text: "Give as directed",
        },
      ],
      interactions: [],
      monitoring: ["CBC q2w"],
      printable_text: "Rx",
    },
    rationale: "Top: toceranib",
    pipeline_summary: "ok",
    trace: [],
    errors: [],
    complete: true,
  };
}

describe("H6 analyze contract — H1 recommendations", () => {
  it("reads recommendations length 7 with score (not fit_score)", () => {
    const recs = getRecommendations(h1CompletePayload());
    expect(recs).toHaveLength(PANEL_SIZE);
    expect(recs.map((r) => r.drug)).toEqual([...PANEL]);
    expect(getDrugScore(recs[0])).toBe(0.38);
    expect(getQuarantined(h1CompletePayload())).toEqual([]);
    expect(getRationale(h1CompletePayload())).toBe("Top: toceranib");
  });

  it("fails when only ranked_drugs is present (v1 analyze shape)", () => {
    const v1 = {
      score_result: {
        subtype: "old",
        ranked_drugs: [{ drug: "toceranib", fit_score: 0.9, rank: 1 }],
        quarantine_drugs: ["piroxicam"],
      },
      rationale_text: "legacy",
    };
    expect(() => getRecommendations(v1)).toThrow(ContractError);
    expect(() => getRecommendations(v1)).toThrow(/ranked_drugs|recommendations/);
  });

  it("fails when flat ranked_drugs replaces recommendations", () => {
    const bad = {
      ...h1CompletePayload(),
      recommendations: undefined,
      ranked_drugs: PANEL.map((d, i) => ({ drug: d, fit_score: 0.1 * i, rank: i + 1 })),
    };
    expect(() => getRecommendations(bad)).toThrow(/ranked_drugs/);
  });

  it("fails getDrugScore on fit_score-only rows", () => {
    expect(() => getDrugScore({ drug: "toceranib", fit_score: 0.9, rank: 1 })).toThrow(
      /fit_score/
    );
  });

  it("fails when recommendations length != 7", () => {
    const short = h1CompletePayload();
    short.recommendations = short.recommendations.slice(0, 3);
    expect(() => getRecommendations(short)).toThrow(/length must be 7/);
  });

  it("fails quarantine_drugs-only payloads", () => {
    expect(() =>
      getQuarantined({ quarantine_drugs: ["piroxicam", "vinblastine"] })
    ).toThrow(/quarantine_drugs/);
  });

  it("fails rationale_text-only complete payloads", () => {
    expect(() => getRationale({ rationale_text: "old text" })).toThrow(/rationale_text/);
  });
});

describe("H6 recipe contract — PharmacistDrugEntry (H5)", () => {
  it("normalizeRecipe preserves H5 fields and asserts them", () => {
    const card = normalizeRecipe(h1CompletePayload().recipe, {
      pet_name: "Angus",
      breed: "Scottish Terrier",
      weight_kg: 12,
      prescribing_vet: "Dr. Test",
    });
    assertRecipeCard(card);
    expect(card.drugs[0].final_dose_mg).toBe(33);
    expect(card.drugs[0].schedule).toBe("MWF");
    expect(card.drugs[0].label_text).toBe("Give as directed");
    expect(card.pet_name).toBe("Angus");
  });

  it("rejects legacy dose_mg/frequency-only drug entries", () => {
    expect(() =>
      assertPharmacistDrugEntry({
        drug: "toceranib",
        dose_mg: 33,
        frequency: "MWF",
        route: "oral",
      })
    ).toThrow(ContractError);
  });

  it("rejects normalizeRecipe when H5 fields stripped to dose_mg/frequency", () => {
    expect(() =>
      normalizeRecipe({
        drugs: [{ drug: "toceranib", dose_mg: 33, frequency: "MWF", route: "oral" }],
      })
    ).toThrow(/legacy dose_mg|legacy frequency/);
  });
});
