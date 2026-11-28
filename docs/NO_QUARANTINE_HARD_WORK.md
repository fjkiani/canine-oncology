# No Quarantine — Hard Work Brief

**Stance:** Do **not** treat PK quarantine / "only toceranib VERIFIED" as an acceptable product strategy. Quarantine was a safety gate that prior agents used as a **sandbag** — ship a one-drug toy while deferring difficult science, data, and ML.

**Evidence bases (verified 2026-11-27):** `/agent/repos/vetonco-backend`, `/agent/repos/vetonco-frontend`, workspace `canine-oncology`. Adjacent inspected via GitHub listing: `fjkiani/ClawBio`, `fjkiani/ai-medical-imaging`; blueprint also references `tessera`, `crispro-backend-v3`, `oncology-backend` / oncology-coPilot, `medical-research-skills` (not cloned here; reuse claims limited to what is ported into VetOnco).

**Canvas:** WriteCanvas unavailable in this session (tool not in namespace). Claim-audit canvas `ce72b83c…` left intact. This document is the durable deliverable.

---

### 0. Anti-sandbag thesis

"We're not quarantining" means the companion **scores and surfaces the full drug panel** for every patient. Uncertainty (missing canine PPB, combo-only ORR, no expr) is shown as **honest dimensions and warnings** — CONDITIONAL, FAIL, incomplete-PK, low evidence — **not** by deleting drugs from the ranked companion. Quarantine-as-product collapsed VetOnco into a toceranib brochure with six greyed-out names and a UI that still markets "7 PASS drugs." That is sandbagging: it avoids PK sourcing, ORR reconciliation, expression plumbing, true ML, clinical persistence, and FE honesty. Safety remains — never invent numbers, never claim ML AUC without a harness — but safety is not a license to hide the hard work.

---

### 1. Difficult work being sandbagged (exhaustive)

For each item: **What's hard** | **Why prior agents avoided it** | **What "done" looks like** | **Evidence path**.

#### PK / pharmacology truth

| | |
|--|--|
| **What's hard** | Source **primary canine** IC50, Cmax, and PPB for every panel drug; reconcile ChEMBL seed gaps (IC50/Cmax, often human/in-vitro) with the free-Cmax SPE gate (`gap = IC50 / (Cmax×(1−PPB))`); decide how incomplete PK informs ranking **without** disappearing the drug. |
| **Why avoided** | Strict VERIFIED-all-three rule + `PASS_DRUGS = [d for d in DRUG_PANEL if d.pk_status == "VERIFIED"]` lets agents ship with **only toceranib** and call it "safety." Mitoxantrone has IC50+Cmax but missing PPB → still UNVERIFIED → score forced to 0. ChEMBL seed marks all 7 `achievable=True` with a **different** gap definition — looks like pharmacology work was done when the feasibility gate never runs for UNVERIFIED drugs. |
| **Done** | Per-drug PK dossier (citation, species, assay, dose); `pk_completeness` / `pk_confidence` fields; gate computes gap whenever any subset allows, else `gap_ratio=null` with explicit missingness; **all drugs remain scored and listed**. No "UNVERIFIED = disappear." |
| **Evidence** | `services/tcc_gene_panels.py` lines 5–13, 260–261 (`PASS_DRUGS` / `QUARANTINE_DRUGS`); `services/feasibility_gate.py` 16–18, 49–55 (UNVERIFIED short-circuit, no gap); `services/chembl_client.py` SEED_DATA gap_ratio = IC50/Cmax (toceranib 0.033) vs gate free-Cmax gap ≈ **0.65×** for Henry PK; `tests/test_dosing.py` asserts six names quarantined; `tests/test_scorer.py` `test_quarantine_count` expects 6. |

#### ORR / evidence grounding

| | |
|--|--|
| **What's hard** | Single source of truth for canine TCC ORR; resolve **Gustafson 2019 6.7% PR** (HowItWorks table) vs **Bernabe 2013 26%** (backend `DrugEntry.orr` + RAG + PetChat); separate combination vs monotherapy claims (Henry mito+piro 35%, Robat gem+piro n=10 40%, Marconato gem+piro 26% on FE); check in missing ground-truth doc. |
| **Why avoided** | Hard literature adjudication. Easier to leave FE on v1 narrative and BE on Bernabe anchors; CI freezes BE arithmetic, not FE honesty. |
| **Done** | Checked-in `VETONCO_GROUND_TRUTH_BENCHMARKS.mdc` (or generated from `DRUG_PANEL` + trial metadata); HowItWorks ORR table and sensitivity scores match backend formula; combo trials labeled `trial_type=combination` and not used as monotherapy ORR without flag; both Gustafson and Bernabe cited with study design notes if both kept. |
| **Evidence** | FE `HowItWorks.tsx` `responseRates` toceranib **"6.7% PR" / Gustafson 2019**; BE `tcc_gene_panels.py` toceranib `orr=0.26`, `orr_source=Bernabe…`; `rag_service.py` bernabe_2013; `PetChat.tsx` shows 26% Bernabe; docstring references `VETONCO_GROUND_TRUTH_BENCHMARKS.mdc` — **file absent** from backend tree; HowItWorks gemcitabine Marconato 26% vs BE Robat 40%. |

#### Molecular / expression path

| | |
|--|--|
| **What's hard** | Real expression intake (upload / lab panel); remap drug targets ↔ 19-gene panel (or expand panel); load/normalize **GSE110661** (Dhawan 2018) and other GEO; make `target_delta` non-zero in clinical use. |
| **Why avoided** | UI hardcodes `expr: {}`; most drug targets are **not** in the gene panel — wiring real expr still yields near-zero deltas for VEGFR2/KIT/PTGS2/TOP2A/etc. Fixing that is biology + product, not a one-line patch. |
| **Done** | Patient can submit log2FC for panel genes; alias map (e.g. KDR↔VEGFR2) or panel expanded to cover drug targets; GSE110661 (or subset) loadable for offline validation; non-empty expr changes rationale `target_delta` in integration tests. |
| **Evidence** | `PetAnalyze.tsx` ~52 `expr: {}`; `agents/state.py` `expr or {}`; programmatic overlap: toceranib hit only **BRAF** (miss VEGFR2, PDGFR, KIT); mitoxantrone/piroxicam/vinblastine/gemcitabine **zero** panel hits; carboplatin ERCC2+MSH2; trametinib MAP2K1 only; panel docstring cites GSE110661 — **not loaded in repo**. |

#### True ML

| | |
|--|--|
| **What's hard** | Define trainable jobs (ranking, outcome, tox risk, retrieval); obtain labels with honest n; eval harness (Brier/log-loss/precision@k); model cards. Stop pretending rules + BM25 + optional LLM **are** the ML product forever. |
| **Why avoided** | No patient-level outcomes in-repo; tiny trial n (gemcitabine combo n=10); CI already "green" with 55 pytest arithmetic freezes; HowItWorks "training sources" table markets provenance as if trained. |
| **Done** | Explicit v0=rules acknowledgment in product UI; label schemas + datasets under `data/`; at least one supervised or Bayesian ranking/outcome prototype with held-out metric; retrieval LTR or embedding eval; **no** claim of AUC/sensitivity without harness. |
| **Evidence** | No `.pkl`/`.pt`/`.onnx`/notebooks in VetOnco trees; scorer is hardcoded formula in `tcc_scorer.py`; RAG is hand BM25 over 8 docs; HowItWorks limitations admit "not from a trained ML model"; blueprint §1 blunt: no trained predictive ML. |

#### Longitudinal clinical data

| | |
|--|--|
| **What's hard** | Durable, auth-scoped DB for pets, serial CBC/chem/imaging, VCOG grades, regimen, response; clinic capture UX; survive restart / multi-device. |
| **Why avoided** | In-memory `_test_log`, `_CONVERSATION_STORE`, Zustand `localStorage` pets — enough for demo screenshots. |
| **Done** | Postgres (or equivalent) with pet/test/chat/outcome tables; VCOG labels persisted from `tcc_test_analyzer`; monitoring agent reads durable history; E2E: restart → data remains. |
| **Evidence** | `routers/canine.py` `_test_log: dict`; `chat_agent.py` `_CONVERSATION_STORE`; FE `lib/store.ts` zustand `persist` localStorage only. |

#### Literature / RAG depth

| | |
|--|--|
| **What's hard** | Grow beyond **8 hand docs**; claim-level chunks (ORR, PK, tox) with verified PMIDs; fix **Ogilvie/Knapp PMID collision**; expose `get_all_literature()`; retrieval eval. |
| **Why avoided** | Curation is slow; Landing hardcodes a mirror; agents treated 8-doc BM25 as "RAG done." |
| **Done** | Corpus ≫8 with unique PMIDs; claim schema; `GET /api/canine/literature`; precision@k tests; Gustafson (and other contested trials) in corpus with structured fields. |
| **Evidence** | `rag_service.py` header "8 published…"; Ogilvie entry `pmid: "8188077"` — **same as Knapp 1994**; `get_all_literature()` defined but no list route (only `/rag/query`); Landing duplicates corpus. |

#### Product / FE honesty

| | |
|--|--|
| **What's hard** | Sync HowItWorks to v2 formula and real panel policy; kill **phantom** quarantine set (Vemurafenib/Dabrafenib/Erdafitinib) **or** put those drugs in `DRUG_PANEL` with real rationale; align FE↔BE types; redeploy. |
| **Why avoided** | HowItWorks still teaches v1 `0.4×tier + 0.4×braf + 0.2×target` and sensitivity toceranib BRAF+ **0.64** vs backend **0.380**; claims **"Ranked list of 7 PASS drugs"** and **"Drug Panel — 7 PASS Drugs"** while BE PASS=1; phantom human BRAF drugs are marketing theater not in code. FE still reads `ranked_drugs` / `quarantine_drugs` / `fit_score`. |
| **Done** | HowItWorks formula = `orr×confidence + braf_delta + target_delta`; panel table matches scored set; quarantine section either removed or matches code; `tsc -p tsconfig.app.json` **0 errors**; UI binds `recommendations`/`quarantined`/`score`. |
| **Evidence** | `HowItWorks.tsx` ~259, 289, 305–320, 346; `PetAnalyze.tsx` ranked_drugs; `types/agent.ts` imports missing `TCCResult`/`CompoundData` from api; **32** `error TS` under `tsconfig.app.json`; `DrugRankingCard` uses `fit_score`. |

#### Pipeline integrity

| | |
|--|--|
| **What's hard** | Fix `recipe_node` TypeError on `PharmacistDrugEntry`; serialize recipe with `asdict`; auth/E2E happy path to `complete=True`. |
| **Why avoided** | Exception handler converts crash to trace error; pipeline can limp without recipe; demo focuses on score_node. |
| **Done** | `d.drug` (attribute) not `d["drug"]`; recipe dict fully JSON-serializable; Angus/Bella/Maisie sync path `complete=True` with recipe; FE consumes it. |
| **Evidence** | `agents/tcc_pipeline_agent.py` ~219 `[d["drug"] for d in card.drugs]` on dataclasses; ~415–420 `recipe_data.drugs` passed raw into result dict; `recipe_generator.py` `PharmacistDrugEntry` dataclass. |

#### Regulatory / safety framing

| | |
|--|--|
| **What's hard** | Position as **veterinary clinical decision support** with transparent rules; refuse ML performance claims without metrics; keep LLM from inventing ORR/doses **without** using that straitjacket to forbid discussing non-toceranib options. |
| **Why avoided** | Chat prompt **"QUARANTINE IS FINAL"** + Landing "quarantined — no exceptions" encodes sandbag as ethics; "training sources" table implies learned model. |
| **Done** | CDS disclaimer; UI labels "rules engine (v0)" until model card exists; chat may discuss scored non-verified drugs with uncertainty — may not invent numbers; no silent autonomous prescribing. |
| **Evidence** | `chat_agent.py` rules 2 "QUARANTINE IS FINAL"; Landing PK quarantine copy; HowItWorks `trainingSources` vs limitations admitting no prospective validation. |

#### Adjacent stack unused

| | |
|--|--|
| **What's hard** | Integrate transferable assets: CrisPRO SPE already ported but full tox/compounding depth unused; Tessera human FM not canine — patterns only; oncology CoPilot RAG/docs patterns; ClawBio / medical-research-skills for literature workflows; PMC downloader for corpus growth. |
| **Why avoided** | Porting SPE quarantine doctrine was enough to justify "CrisPRO heritage"; connecting Tessera weights or CoPilot corpora would surface domain mismatch and force real data work. |
| **Done** | Written reuse map with concrete hooks (what file, what not to import); at least one adjacent capability actually wired (e.g. literature pipeline skill → corpus expansion) beyond the SPE port. |
| **Evidence** | `feasibility_gate.py` "ported from CrisPRO"; chembl/recipe unrelated to Tessera; GitHub-visible `fjkiani/ClawBio`, `ai-medical-imaging`; prior blueprint: tessera 0 canine hits; oncology-backend human CoPilot — not canine ORR labels. |

---

### 2. What we NEED (requirements, not vibes)

#### MUST-HAVE — companion MVP that **scores the full panel**

| Need | Spec |
|------|------|
| **Full-panel scorer** | Remove eligibility filter `PASS_DRUGS`; iterate `DRUG_PANEL`; every drug gets `score`, `rank`, `orr`, `pk_status`, `pk_missing[]`, `gap_ratio?`, `feasibility_verdict`. |
| **PK as dimension** | Schema fields + UI chips; CONDITIONAL/FAIL/incomplete-PK = warnings, not deletion. |
| **ORR SOT** | Checked-in ground-truth file; FE HowItWorks + Landing + RAG must match; combo vs mono explicit. |
| **Expr path** | FE control to submit gene→log2FC; BE alias/expand targets; test that expr changes `target_delta`. |
| **Pipeline fix** | `recipe_node` attribute access + `asdict` serialization; E2E `complete=True`. |
| **FE contract** | Unify `types/api.ts` / `agent.ts`; `tsc -p tsconfig.app.json` clean; bind `recommendations` not `ranked_drugs`. |
| **HowItWorks honesty** | v2 formula; no "7 PASS"; phantom Vemurafenib set removed or coded. |
| **Persistence** | Durable pets/tests/chat (auth-scoped). |
| **CDS framing** | Product copy: rules CDS today; no ML performance claims. |
| **Chat policy rewrite** | Drop "quarantine is final / never suggest"; replace with "do not invent numbers; surface uncertainty." |
| **Eval gate (non-ML)** | Tests that **fail** if recommendations length collapses to 1 under quarantine policy; assert all panel drugs scored. |

#### NEXT — calibrated ML

| Need | Spec |
|------|------|
| **Label schemas** | `trial_orr_labels`, `patient_outcome` (ORR/CBR/MST), `vcog_series`, `pmid_relevance`. |
| **Datasets** | Digitized published tables (verified per paper); prospective clinic export; GSE110661 processed matrix. |
| **Model cards** | Ranking, tox-risk, retrieval — features, n, metrics, failure modes. |
| **Services** | `ranking_model` / `tox_model` / `retriever` behind feature flags; rules remain fallback. |
| **UI surfaces** | Calibrated intervals; "model vs rules" provenance badge. |
| **Eval gates** | Held-out Brier/log-loss / precision@k in CI; **block** marketing strings that claim ML without passing gate. |

---

### 3. Full-panel scoring design (no quarantine hide)

**Principle:** Score all; annotate PK/evidence; warn — never hide.

```
final_score = clip(orr_base × confidence + braf_delta + target_delta, 0, 1)
# unchanged arithmetic — applied to EVERY DrugEntry in DRUG_PANEL

attach:
  pk_status, pk_ic50_um, pk_cmax_um, pk_ppb, pk_source, pk_missing[]
  feasibility_verdict ∈ {PASS, CONDITIONAL, FAIL, INCOMPLETE_PK}
  gap_ratio | null
  evidence_tier, orr, orr_source, orr_n, trial_type
```

**UI:** `DrugGrid` shows one ranked list. Incomplete PK / CONDITIONAL / FAIL render as warning pills on the card, not a separate "disappeared" rail that implies non-recommendation. Optional secondary sort: "PK-complete first" as a **filter the vet chooses**, default = full ranking.

**Code change sites (must edit):**

| Location | Change |
|----------|--------|
| `tcc_gene_panels.py` `PASS_DRUGS` / `QUARANTINE_DRUGS` | Stop using as scoring eligibility; keep only as derived views of `pk_status` if needed for analytics. |
| `tcc_scorer.py` loop over `PASS_DRUGS` + quarantine block that forces `score=0` | Single loop over `DRUG_PANEL`; always compute score + gate (even if incomplete). |
| `feasibility_gate.py` UNVERIFIED immediate return | Compute gap when possible; else `INCOMPLETE_PK` with missing fields — **do not** block scoring upstream. |
| `chat_agent.py` "QUARANTINE IS FINAL" | Rewrite for uncertainty-aware discussion. |
| `HowItWorks.tsx` "7 PASS" / sensitivity / ORR / phantom Vemurafenib | Sync to v2 + real panel. |
| `DrugGrid.tsx` / `DrugRankingCard.tsx` | Render PK/feasibility dimensions; consume `score` not `fit_score`. |
| `PetRecipe.tsx` `STANDARD_DRUGS = ["toceranib"]` | Allow multi-drug from scored panel. |
| Tests (`test_scorer`, `test_dosing`, `test_gate`) | **Invert** quarantine-count assertions that encode sandbag as correctness. |

---

### 4. ML model — what it must eventually do

| User-facing job | Training target | Obtainable labels (vet oncology) | Features |
|-----------------|-----------------|----------------------------------|----------|
| **Rank drugs for this dog** | Preference / expected benefit ranking | Published trial ORR anchors + oncologist preference pairs; later clinic choice | BRAF, breed prior, expr, MSH2, PK dims, evidence tier, weight/organs |
| **Estimate benefit** | P(ORR or clinical benefit \| drug, …) | Trial-level ORR with hierarchical pooling; digitized patient tables where released; prospective clinic ORR/CBR | Same + regimen |
| **Tox / HOLD risk** | P(VCOG ≥3 or HOLD in horizon) | Serial labs already graded by rules → promote to labels; published tox tables | ANC, Plt, Hct, Cr, ALT, BUN, drug, days since dose |
| **Monitoring alerts** | Trend severity | Multi-visit series from durable store | Slopes + absolute grades |
| **Literature answer** | Relevant PMID / claim | Relevance judgments on expanded corpus | Query, drug, BRAF context, trial_type |
| **Explanation** | Not trained for numbers | N/A — LLM narrates tool outputs only | Tool JSON |

**Non-goals until labels exist:** Tessera-style foundation weights on canine WGS; claiming survival from BRAF alone (Gedon 2021 limitation already on HowItWorks).

---

### 5. Agent-executable hard packages

Acceptance criteria are written so **re-quarantining cannot pass**.

| ID | Goal | Hardness | Repos / files | Acceptance (ungameable) |
|----|------|----------|---------------|-------------------------|
| **H1** | Full-panel scoring | Eng + policy | BE `tcc_scorer.py`, `tcc_gene_panels.py`, tests | For fixed Angus inputs, `len(recommendations)==7` (or `len(DRUG_PANEL)`); **no** test asserts `len(quarantined)==6` as success; CI fails if PASS filter restored. |
| **H2** | PK dossiers without deletion | Science | `tcc_gene_panels.py`, `feasibility_gate.py`, new `docs/pk/*.md` | Each drug has structured PK fields or explicit `pk_missing`; gate returns INCOMPLETE_PK not silent drop; scored list still length 7. |
| **H3** | ORR SOT + FE sync | Science + FE | New ground-truth file; `HowItWorks.tsx`; `rag_service.py` | HowItWorks toceranib ORR row matches Bernabe 26% **or** dual-cites Gustafson with design note — **cannot** be sole 6.7% while BE uses 0.26; sensitivity BRAF+ toceranib = **0.380**. |
| **H4** | Expr intake + target remap | Eng + bio | `PetAnalyze.tsx`/`PetNew`; `tcc_gene_panels.py` | Uploading `{BRAF: 3.0}` (or remapped KDR) changes `target_delta` in API rationale vs `expr:{}`. |
| **H5** | recipe_node + JSON | Eng | `tcc_pipeline_agent.py`, `canine.py` | Sync pipeline `complete=True`; recipe JSON has string drug names; no TypeError in trace. **Next extractable task:** [`AGENT_TASK_H5_RECIPE_NODE.md`](AGENT_TASK_H5_RECIPE_NODE.md) (after H1). |
| **H6** | FE type contract | Eng | `types/*`, `DrugRankingCard`, `DosageCard`, `PetAnalyze` | `npx tsc -p tsconfig.app.json --noEmit` exit 0; UI shows backend `recommendations`. |
| **H7** | Durable clinical store | Eng | BE store + FE `store.ts` | After process restart, tests/chat for pet_id remain; auth scope enforced. |
| **H8** | RAG expansion + PMID integrity | Science | `rag_service.py`, literature route | Corpus size >8; **unique PMIDs** (Ogilvie ≠ 8188077); retrieval eval test file exists. |
| **H9** | ML scaffold + first gate | ML | `data/`, model card, eval test | Label schema checked in; CI job runs metric harness; marketing "trained model" strings forbidden unless gate green. |
| **H10** | Kill phantom quarantine theater | Product | `HowItWorks.tsx`, optionally `DRUG_PANEL` | Vemurafenib/Dabrafenib/Erdafitinib either absent from UI **or** present in `DRUG_PANEL` with scored rationale — no third marketing-only set. |

---

### 6. Sandbag detection checklist

An agent is **still sandbagging** if any of these appear:

- [ ] "Ship with 1 VERIFIED / quarantine the rest" as the MVP definition
- [ ] Restores or defends `PASS_DRUGS` filter as product strategy
- [ ] "Leave HowItWorks for later" while claiming companion is honest
- [ ] Leaves `expr: {}` hardcoded / "expression optional forever"
- [ ] Treats ChEMBL `gap_ratio` (IC50/Cmax) as the feasibility gate without free-Cmax / PPB
- [ ] Keeps phantom Vemurafenib quarantine set without coding those drugs
- [ ] Catches `recipe_node` errors and still reports success / skips serialization fix
- [ ] Defers FE `tsc` / field rename (`ranked_drugs`, `fit_score`)
- [ ] "Rules are fine forever" with no model card / label schema / eval path
- [ ] Claims Tessera/CrisPRO/CoPilot integration while only SPE quarantine doctrine is ported
- [ ] Chat still says quarantined drugs must never be discussed as options
- [ ] Adds more UNVERIFIED reasons instead of scoring + annotating
- [ ] Uses missing `.mdc` / "science later" to avoid ORR reconciliation
- [ ] In-memory persistence left as "good enough for launch"
- [ ] Marketing "7 PASS" or "training sources" without matching backend truth

---

### Appendix A — Verified numeric anchors (this audit)

| Claim | Value | Path |
|-------|-------|------|
| PASS drugs at runtime | **1** (toceranib) | `PASS_DRUGS` |
| Quarantined | **6** | `QUARANTINE_DRUGS` / tests |
| Toceranib ORR (BE) | **0.26** Bernabe 2013 | `tcc_gene_panels.py` |
| Toceranib ORR (HowItWorks table) | **6.7% PR** Gustafson 2019 | `HowItWorks.tsx` |
| Toceranib BRAF+ score (BE) | **0.380** | `test_scorer.py` / formula |
| Toceranib BRAF+ (HowItWorks sensitivity) | **0.64** | v1 formula |
| Gate gap toceranib | **~0.65×** | Henry IC50/Cmax/PPB |
| ChEMBL seed gap toceranib | **0.033** | different definition |
| FE tsc errors | **32** | `tsc -p tsconfig.app.json` |
| RAG docs | **8** | `rag_service.py` |
| Ogilvie pmid field | **8188077** (Knapp collision) | `rag_service.py` |
| Expr from UI | **`{}`** | `PetAnalyze.tsx` |

### Appendix B — Relation to prior blueprint

`docs/VETONCO_ML_PRODUCT_BLUEPRINT.md` correctly diagnosed "no trained ML" and listed sandbags — but its **Ideal product / MVP** still centered **"honest evidence ranking under PK quarantine"** and **"one VERIFIED drug path."** That framing is rejected here. Quarantine may remain a **label**; it must not remain the **product strategy**.
