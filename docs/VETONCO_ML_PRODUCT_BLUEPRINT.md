# VetOnco ML / Product Architecture Blueprint

**Evidence sources (verified 2026-11-27):** `/agent/repos/vetonco-backend`, `/agent/repos/vetonco-frontend`, plus GitHub inspection of `fjkiani/tessera`, `crispro-backend-v3`, `oncology-backend`, `ClawBio`, `medical-research-skills`.  
**Claim-audit canvas** `ce72b83c-0be7-477f-8dca-b7575eaf44d3` left intact (WriteCanvas unavailable in this session).

---

## 1. What is “our ML model” today

**Blunt answer:** There is no trained predictive ML model. VetOnco is a **deterministic rules engine** (ORR-anchored scorer + CrisPRO-ported SPE feasibility gate + BSA/weight dosing) with **BM25 literature retrieval** over 8 hand-authored docs and an **optional OpenRouter LLM** that may only narrate tool outputs. The LangGraph “agent” orchestrates those steps; it does not learn. CI freezes arithmetic (`55/55` pytest), not clinical discrimination (no AUC/outcome training).

| Component | Learned? | Inputs | Outputs | Status |
|-----------|----------|--------|---------|--------|
| TCC Scorer v2 (`score_tcc`) | **No** — hardcoded formula | `expr`, BRAF, breed, MSH2 | Ranked PASS drugs + quarantine list + template rationale | Live; only **toceranib** VERIFIED |
| Feasibility gate | **No** — arithmetic | IC50, Cmax, PPB | PASS / CONDITIONAL / FAIL / UNVERIFIED + `gap_ratio` | Ported from CrisPRO SPE; bands 5× / 50× |
| RAG (`retrieve`) | **No** — BM25 | Query string | Top-k literature chunks | 8 hand docs; no embeddings |
| LLM (`llm_service`) | Foundation LLM only (not VetOnco-trained) | Structured tool outputs | Narrative text or `None` | Optional; straitjacket forbids inventing numbers |
| LangGraph TCC pipeline | Orchestration only | Patient fields + `expr` | SSE trace + serialized result | **`recipe_node` TypeError** on live path |
| Monitoring agent | **No** — slope + thresholds | Test history | Alerts + optional LLM summary | Rules; history usually in-memory |
| ChEMBL client | **No** — seed dict (+ optional live) | Drug names | MW / IC50 / gap / SMILES | Defaults to `SEED_DATA` |
| Dosing / recipe | **No** — formulas + compounding tables | Weight, Cr, ALT, drug list | `DoseResult`, PDF recipe card | Deterministic |
| Frontend “training sources” table | Marketing / provenance copy | — | — | **Not** a training set in-repo |

**Formula (backend truth):**  
`final_score = clip(orr_base × confidence + braf_delta + target_delta, 0, 1)`  
in `services/tcc_scorer.py`.

---

## 2. Stubbed inputs vs data we have

| Input | Stubbed how | Data that exists | Gap to make real |
|-------|-------------|------------------|------------------|
| Gene expression `expr` | `PetAnalyze` sends `expr: {}` | Scorer `_target_delta` + 19-gene tiers in `tcc_gene_panels.py` | UI/API to upload log2FC; align gene IDs to drug targets |
| Drug–target overlap | Most drug targets **absent** from panel | Panel: FGFR3, EGFR, ERBB2, PIK3CA, HRAS, BRAF, MAP2K1, …; drug targets e.g. VEGFR2, KIT, PTGS2, TOP2A | Expand panel **or** map aliases (KDR↔VEGFR2); today overlap ≈ BRAF, MAP2K1, ERCC2, MSH2 only |
| PK for 6/7 drugs | `pk_status=UNVERIFIED` → quarantine | ORR + citations; mitoxantrone partial IC50/Cmax | Primary canine IC50 + Cmax + PPB per drug |
| Literature list API | `get_all_literature()` **no route** | Full corpus in `rag_service.LITERATURE_CORPUS`; Landing hardcodes mirror | `GET /api/canine/literature` |
| Pets / tests / chat | Pets: Zustand `localStorage`; tests: `_test_log`; chat: `_CONVERSATION_STORE` | API shapes exist | Durable DB + auth-scoped persistence |
| GSE110661 | Cited in panel docstring / HowItWorks | External GEO (Dhawan 2018); **not loaded** in repo | Download, normalize to panel genes |
| Ground-truth doc | Referenced as `VETONCO_GROUND_TRUTH_BENCHMARKS.mdc` | Numeric anchors **embedded in tests** + `DrugEntry.orr` | Check in the missing `.mdc` or generate from `DRUG_PANEL` |
| ChEMBL live | `use_live_api=False` by default | Seed compounds for all 7 drugs | Optional live enrich; keep seed as fail-closed |
| Tessera / human FMs | N/A to canine TCC | Human SNV/CNA foundation model (TCGA); **0 canine hits** | Do not treat as VetOnco weights |
| CrisPRO SPE | Already ported (adapted verdict labels) | `crispro-backend-v3` `feasibility_gate.py` | Keep sync docs; VetOnco adds VERIFIED PK gate |

**Classification legend:** STUBBED / HARDCODED / COMPUTED / LEARNED / ABSENT  
- Scorer weights, ORR, BRAF deltas, breed priors, compounding tables → **HARDCODED**  
- Scores, gap ratios, doses, VCOG grades, BM25 ranks → **COMPUTED**  
- `expr: {}`, live ChEMBL off, literature GET, DB → **STUBBED / ABSENT**  
- Any `.pkl` / `.pt` / `.onnx` / notebooks in VetOnco → **ABSENT**  
- LEARNED VetOnco parameters → **ABSENT**

---

## 3. What we can train (realistic ladder)

### v0 — Rules (shipped)
- **Objective:** Deterministic, auditable drug ranking under PK quarantine.
- **Labels:** Published ORR fractions on `DrugEntry` (trial-level, not patient-level).
- **Features:** BRAF status, breed prior, optional expr, MSH2 flag.
- **Why now:** Already implemented; eval = exact numeric pytest.
- **Harness:** `tests/test_scorer.py`, `test_gate.py`, `test_dosing.py`, `test_integration.py` (Angus/Bella/Maisie); CI `.github/workflows/eval.yml`.

### v1 — Ranking / retrieval learning
- **Objective:** Better literature ranking (learn BM25 params or lightweight LTR) and/or learn small deltas that improve agreement with oncologist preference / published protocol choice.
- **Labels:** (a) PMID relevance judgments on expanded corpus; (b) protocol-choice proxies from published algorithms — **not** individual dog outcomes yet.
- **Features:** Query tokens, drug, BRAF, trial_type, n, orr_pct.
- **Why feasible soon:** Corpus and retrieve() exist; grow beyond 8 docs via PMC/PMID curation (owner has `PMC-Downloader`).
- **Why not outcome ML yet:** No patient-level response dataset in-repo.
- **Harness:** Add retrieval precision@k tests beside `rag_service.py`; keep fail-closed on fabricated ORR.

### v1b — Toxicity / monitoring model
- **Objective:** Predict risk of VCOG grade escalation or HOLD from serial CBC/chem.
- **Labels:** VCOG grades already computed by `tcc_test_analyzer` (rules today); need multi-visit labeled series (clinic partners or synthetic from published tox tables).
- **Features:** ANC, platelets, Hct, Cr, ALT, BUN, drug regimen, time since dose.
- **Why later-than-v1:** Needs longitudinal data collection; rules in `monitoring_agent.py` are the correct v0.
- **Harness:** Extend monitoring agent unit tests with synthetic worsening series.

### v2 — Outcome model
- **Objective:** Calibrated `P(ORR or clinical benefit | drug, BRAF, breed, labs)` and/or survival risk — **only** with obtainable labels.
- **Labels/sources (obtainable, not invented):**  
  - Trial-level ORR already in panel (meta-analytic / hierarchical Bayesian partial pooling across drugs).  
  - Digitized published patient-level tables where authors released them (must be verified per paper — **do not invent**).  
  - Prospective clinic outcomes (response, VCOG, MST) under IRB — future.
- **Features:** Same as v0 + optional panel expr once real.
- **Why later:** n per drug is tiny (e.g. gemcitabine combo n=10); risk of overclaim. Prefer Bayesian shrinkage over deep nets.
- **Harness:** New `tests/test_outcome_model.py` with proper scoring rules (Brier/log-loss on held-out trials) — **absent today**.
- **Non-goal first:** Tessera-style foundation models, canine WGS pretraining.

### Adjacent assets (honest reuse)
| Repo | Useful for VetOnco? |
|------|---------------------|
| `crispro-backend-v3` | SPE / quarantine doctrine already ported |
| `tessera` | Human cancer FM — **no canine TCC**; reuse patterns only |
| `oncology-backend` | Human CoPilot + RAG docs — not canine ORR labels |
| `ClawBio` / `medical-research-skills` | Agent skill libraries for literature/protocol work — not weights |
| `canine-oncology` workspace | Empty stub — this blueprint lives here |

---

## 4. Sandbagged / left behind by prior agents

1. **`recipe_node` TypeError** — `agents/tcc_pipeline_agent.py` line ~219: `[d["drug"] for d in card.drugs]` on `PharmacistDrugEntry` dataclasses. Verified: pipeline ends with `recipe_node: 'PharmacistDrugEntry' object is not subscriptable`; `complete=False`.
2. **`build_pipeline_result` JSON hazard** — even after fixing (1), `recipe.drugs` is passed as dataclass list without `asdict` (`tcc_pipeline_agent.py` ~415–420); SSE `complete` would fail to serialize if recipe succeeded.
3. **`PetAnalyze` hardcodes `expr: {}`** — `src/routes/PetAnalyze.tsx` ~52; expression path never exercised in UI.
4. **FE reads v1 field names** — `ranked_drugs` / `quarantine_drugs` vs backend `recommendations` / `quarantined`; `fit_score` vs `score` (`PetAnalyze.tsx`, `types/agent.ts`, `DrugRankingCard.tsx`).
5. **`tsc` broken** — 32 errors: missing `TCCResult`/`CompoundData` exports, `DoseResult.hold`/`frequency`/`adjustments`, etc.
6. **HowItWorks still v1** — formula `0.4×tier + 0.4×braf + 0.2×target`; sensitivity shows toceranib BRAF+ **0.64** vs backend **0.380**.
7. **ORR table contradicts backend anchors** — e.g. HowItWorks toceranib **6.7% Gustafson 2019** vs backend **26% Bernabe 2013**; gemcitabine Marconato 26% vs Robat 40%; Allstadt used for mito/carbo RCT vs backend vinblastine 22%.
8. **`get_all_literature()` dead** — defined in `rag_service.py`, only `/rag/query` exposed; Landing duplicates corpus.
9. **Gene panel vs targets mismatch** — verified programmatically; most targets miss panel.
10. **Missing ground-truth doc** — `VETONCO_GROUND_TRUTH_BENCHMARKS.mdc` referenced, not in backend tree; HowItWorks cites `report_vetonco_science.md` “results archive” — not in FE repo.
11. **PASS panel marketing vs quarantine reality** — HowItWorks claims “7 PASS drugs”; backend PASS = VERIFIED PK only → **1**.
12. **In-memory / localStorage persistence** — `_test_log`, chat history, Zustand pets.
13. **LLM node “ok” with unavailable** — OpenRouter key often unset; status ok with empty rationale.
14. **Landing exists and is routed** (`App.tsx` `/`) — prior “undeployed Landing” is overstated; literature **API** is what’s undeployed. FE build may still fail on `tsc` depending on CI strictness.
15. **Non-agent `/tcc/pipeline` recipe step** — returns `card.drugs` dataclasses in JSON path similarly risky (`routers/canine.py` ~336).

---

## 5. Ideal product

**Thesis:** VetOnco should be the **vet-first canine TCC oncology companion**: honest evidence ranking under PK quarantine, weight-safe dosing, compounding-ready prescriptions, longitudinal toxicity monitoring, and literature-grounded explanation — never a black-box “AI diagnosis.”

**Journey moments:**  
1. Intake (pet, breed, weight, BRAF, optional MSH2/expr)  
2. Analyze (transparent score + quarantine reasons + feasibility gap)  
3. Dose + recipe (organ-adjusted, printable/PDF)  
4. Monitor (CBC/chem/imaging → VCOG grades + trend alerts)  
5. Chat (RAG-cited answers; LLM cannot invent ORR/doses)

**MVP → v1 → v2:**  
- **MVP:** Fix pipeline + FE type contract; one VERIFIED drug path end-to-end; HowItWorks synced to v2; durable pets optional.  
- **v1:** Expr upload; dequarantine drugs with real PK; literature API + corpus growth; retrieval evals; monitoring persistence.  
- **v2:** Outcome/calibration model on obtainable labels; clinic outcome logging.

**Non-goals:** Autonomous prescribing; human BRAF V600E drug transfer without canine evidence; foundation-model-first; silent override of quarantine; training claims without held-out metrics.

---

## 6. Agent build plan

| # | Goal | Repo / entry files | Acceptance | Depends | Parallel? | Invasiveness |
|---|------|--------------------|------------|---------|-----------|--------------|
| **P1** | Fix `recipe_node` + serialize recipe with `asdict` | BE `agents/tcc_pipeline_agent.py`, `routers/canine.py` | Pipeline sync Angus → `complete=True`, recipe in SSE JSON | — | **Yes** | Low |
| **P2** | Align FE types/components to BE v2 field names | FE `types/api.ts`, `types/agent.ts`, `DrugRankingCard`, `DosageCard`, `PetAnalyze`, `utils.ts` | `tsc --noEmit` clean; UI shows `recommendations` | — | **Yes** (vs P1) | Med |
| **P3** | HowItWorks = v2 formula + ORR from `DRUG_PANEL` / corpus | FE `HowItWorks.tsx` | Toceranib BRAF+ sensitivity 0.38; ORR rows match Bernabe/Knapp/… | Prefer after P2 | After P2 | Low |
| **P4** | Expr UI + gene/target alignment | FE PetNew/Analyze; BE `tcc_gene_panels.py` | Non-empty expr changes `target_delta` in rationale | P2 | Parallel w/ science | Med |
| **P5** | `GET` literature + optional Landing fetch | BE `routers/canine.py`, `rag_service.py`; FE Landing | Route returns 8 docs; Landing can use API | — | **Yes** | Low |
| **P6** | PK sourcing / dequarantine workflow | BE `tcc_gene_panels.py`, tests | Each new VERIFIED drug: gate + scorer tests green | Science judgment | Independent | Med |
| **P7** | Persist pets/tests/chat | BE new store; FE store.ts | Survive restart; auth-scoped | P2 helpful | After MVP path | **High** |
| **P8** | ML data scaffolding | BE `data/` labels CSV from corpus; retrieval eval tests | Documented label schema; no fake patient outcomes | P5 | Independent | Med |

---

## 7. Code entry points map

| Path | Function / symbol | Extend for |
|------|-------------------|------------|
| `vetonco-backend/services/tcc_scorer.py` | `score_tcc`, `_target_delta`, `build_score_rationale` | Formula, learned deltas later |
| `vetonco-backend/services/tcc_gene_panels.py` | `DRUG_PANEL`, `PASS_DRUGS`, `BRAF_BREED_PRIORS`, gene tiers | ORR/PK/targets/panel |
| `vetonco-backend/services/feasibility_gate.py` | `compute_feasibility` | Band thresholds / PK policy |
| `vetonco-backend/services/rag_service.py` | `retrieve`, `get_all_literature`, `LITERATURE_CORPUS` | Corpus + retrieval model |
| `vetonco-backend/services/llm_service.py` | `generate_*` | Prompts only — no arithmetic |
| `vetonco-backend/services/chat_agent.py` | `chat`, straitjacket prompt | Tool-grounded Q&A |
| `vetonco-backend/services/tcc_dosing.py` | `compute_canine_dose`, maps | Dose tables |
| `vetonco-backend/services/recipe_generator.py` | `generate_recipe_card`, `PharmacistDrugEntry` | Compounding |
| `vetonco-backend/services/tcc_test_analyzer.py` | `analyze_test_results` | VCOG rules |
| `vetonco-backend/services/chembl_client.py` | `enrich_panel`, `SEED_DATA` | Compound metadata |
| `vetonco-backend/agents/tcc_pipeline_agent.py` | `score_node`…`llm_node`, `run_tcc_pipeline_sync` | Agent graph |
| `vetonco-backend/agents/monitoring_agent.py` | `trend_node`, `alert_node` | Longitudinal risk |
| `vetonco-backend/routers/canine.py` | `/tcc/*`, `/rag/query`, chat | HTTP surface |
| `vetonco-backend/routers/agent.py` | `/agent/run` SSE, `/agent/monitor` | Streaming |
| `vetonco-backend/tests/*` + `eval.yml` | 55 tests | Freeze science |
| `vetonco-frontend/src/routes/PetAnalyze.tsx` | `handleRun` | Expr + result mapping |
| `vetonco-frontend/src/lib/store.ts` | Zustand persist | Pets/tests |
| `vetonco-frontend/src/routes/HowItWorks.tsx` | formula + ORR tables | Transparency sync |
| `vetonco-frontend/src/routes/Landing.tsx` | `LITERATURE` const | Marketing corpus |
| `vetonco-frontend/src/lib/agentStream.ts` | `streamAgentRun` | SSE contract |
| `vetonco-frontend/src/types/api.ts` | `DrugRecommendation`, … | Contract with BE |

---

## 8. What the future ML model should do

User-facing, precise:

1. **Ranking:** Given BRAF/breed/labs/(expr), return an ordered shortlist of **eligible** drugs with calibrated confidence intervals around expected benefit — starting from published ORR anchors, not invented scores. Quarantine remains a hard gate until PK is VERIFIED.
2. **Risk:** Flag rising myelosuppression / azotemia / hepatotoxicity risk under the current regimen; recommend HOLD/reduce consistent with VCOG — rules first, supervised model when serial labels exist.
3. **Monitoring:** Convert multi-visit labs/imaging into trend alerts tied to implicated drugs (`DRUG_IMPLICATED_MAP` today).
4. **Retrieval:** Surface the correct trial citation for the question (drug, combo, BRAF context) with BM25→learned ranker; never invent PMIDs or ORR.
5. **Explanation:** LLM restates tool outputs only; the “model” users trust for numbers remains deterministic code + published tables.

**Uncertainty callouts:** Appenzeller-scale breed priors cited on HowItWorks are **not** encoded as the six-key `BRAF_BREED_PRIORS` dict in backend (Scottish Terrier 0.85, etc.). Tessera and human oncology repos do **not** supply canine TCC training labels. No patient-level response matrix was found in VetOnco trees.
