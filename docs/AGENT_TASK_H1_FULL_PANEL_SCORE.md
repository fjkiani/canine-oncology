# AGENT TASK H1 — Full-panel score (one deliverable)

**Repo:** `https://github.com/fjkiani/vetonco-backend` (NOT canine-oncology)  
**Branch naming:** `cursor/h1-full-panel-score-<suffix>` off that repo’s `main`  
**Scope:** Backend scorer + tests + gate behavior only. **Do not** “fix” this by writing docs, changing HowItWorks, or re-quarantining under a new name.

---

## Goal (one sentence)

`score_tcc()` must return a **ranked recommendation for every drug in `DRUG_PANEL`** (currently 7). Incomplete PK is a **field on the recommendation**, not a reason to omit the drug or force `score=0`.

---

## Forbidden sandbags (instant fail)

- Leaving `for drug in PASS_DRUGS` as the only scored loop.
- Keeping six drugs in `result.quarantined` with `score=0.0` / `rank=99`.
- Renaming quarantine (`hidden`, `excluded`, `deferred`) while still omitting them from `recommendations`.
- Shipping only a markdown explanation without green tests.
- Changing ORR/PK numbers to make tests pass.
- Touching frontend / HowItWorks / Landing in this task.
- Claiming “ML” or new models.

---

## Exact code changes

### 1. `services/tcc_scorer.py` → `score_tcc`

- Iterate **`DRUG_PANEL`** (all drugs), not `PASS_DRUGS`.
- For each drug compute the existing formula:

  `final_score = clip(orr_base × evidence_confidence + braf_delta + target_delta, 0, 1)`

  (`orr_base = drug.orr or 0.0`)
- Call `compute_feasibility(...)` for every drug.
- Set `quarantined=False` for all scored rows (or remove the field usage for ranking).
- Sort by `score` desc; assign `rank = 1..N`.
- `result.recommendations` length **must equal** `len(DRUG_PANEL)`.
- `result.quarantined` must be **`[]`** (empty). Do not populate a parallel hide-list.
- Summary string: report panel size and PK-incomplete count, not “Verified drugs: 1 | Quarantined: 6”.

### 2. `services/feasibility_gate.py` → `compute_feasibility`

- **Stop** returning early with no gap solely because `pk_status != "VERIFIED"`.
- If IC50, Cmax, and PPB are all present → compute gap and PASS/CONDITIONAL/FAIL as today.
- If any PK value missing → `verdict="INCOMPLETE_PK"`, `gap_ratio=None`, rationale lists which of `ic50|cmax|ppb` is missing.
- Keep VERIFIED/UNVERIFIED on the **drug record** (`pk_status`); do not use it to skip scoring.

### 3. `services/tcc_gene_panels.py`

- You may keep `PASS_DRUGS` / `QUARANTINE_DRUGS` as **deprecated aliases** for “pk_status == VERIFIED” filters used by dosing defaults, **but scorer must not use them to exclude drugs**.
- Do not delete ORR/PK source citations.
- Do not invent new PK numbers.

### 4. Downstream callers (minimal)

- `agents/tcc_pipeline_agent.py` `score_node`: `top_drugs` = top 3 from **full** `recommendations` (still exclude trametinib when BRAF negative if that guard exists).
- `services/chat_agent.py`: delete or rewrite rule “QUARANTINE IS FINAL” so the model may discuss any **scored** drug and must state `pk_status` / `feasibility_verdict` honestly. Do not tell the model quarantined drugs are off-limits because quarantine ranking is gone.
- `services/tcc_dosing.py`: out of scope for ranking; leave `compute_full_panel_dosage` default as-is **unless** a test breaks solely due to import renames.

---

## Tests you must rewrite / add

File: `tests/test_scorer.py` (and gate tests as needed).

### Replace sandbag assertions

Delete or invert:

- `assert len(result.recommendations) == 1`
- `assert len(result.quarantined) == 6`
- `test_pass_count` / `test_quarantine_count` as currently written

### Required new assertions (non-gameable)

```python
PANEL = {"toceranib", "mitoxantrone", "piroxicam", "vinblastine",
         "carboplatin", "gemcitabine", "trametinib"}

def test_full_panel_scored_braf_positive():
    r = score_tcc(braf_status="positive", breed="scottish terrier", expr={})
    names = [x.drug for x in r.recommendations]
    assert len(r.recommendations) == 7
    assert set(names) == PANEL
    assert r.quarantined == []
    # Exact scores (expr empty) — from current DRUG_PANEL arithmetic
    by = {x.drug: x for x in r.recommendations}
    assert by["toceranib"].score == 0.38
    assert by["mitoxantrone"].score == 0.35
    assert by["gemcitabine"].score == 0.28
    assert by["carboplatin"].score == 0.266
    assert by["trametinib"].score == 0.2
    assert by["piroxicam"].score == 0.18
    assert by["vinblastine"].score == 0.154
    assert names[0] == "toceranib"  # rank order
    assert by["toceranib"].feasibility_verdict == "PASS"
    assert by["toceranib"].gap_ratio == 0.6494
    assert by["piroxicam"].feasibility_verdict == "INCOMPLETE_PK"
    assert by["mitoxantrone"].feasibility_verdict == "INCOMPLETE_PK"  # missing PPB

def test_full_panel_braf_negative_rank():
    r = score_tcc(braf_status="negative", breed="other", expr={})
    assert [x.drug for x in r.recommendations] == [
        "mitoxantrone", "gemcitabine", "carboplatin", "toceranib",
        "piroxicam", "vinblastine", "trametinib",
    ]
    assert r.recommendations[-1].drug == "trametinib"
    assert r.recommendations[-1].score == 0.0

def test_cannot_hide_behind_pass_filter():
    """Fails if someone restores PASS_DRUGS-only scoring."""
    from services.tcc_gene_panels import DRUG_PANEL, PASS_DRUGS
    r = score_tcc(braf_status="positive")
    assert len(PASS_DRUGS) == 1  # PK truth unchanged
    assert len(r.recommendations) == len(DRUG_PANEL) == 7
```

### Gate unit tests

- VERIFIED toceranib still PASS @ 0.6494.
- Missing PPB → `INCOMPLETE_PK`, not silent UNVERIFIED-with-no-fields that implies “do not score.”
- If all three PK present on an UNVERIFIED-labeled drug, still compute gap (status label ≠ skip).

### Integration

Update `tests/test_integration.py` / dosing tests that assume `len(recommendations)==1` or “six quarantined.” Toceranib score anchors (0.380 / 0.310 / 0.260) must still hold for that drug; other drugs must appear in recommendations.

---

## Acceptance (all required)

```bash
cd vetonco-backend
python -m pytest tests/ -v
```

1. **Exit 0.**  
2. `test_full_panel_scored_braf_positive` passes with **exact** scores above.  
3. `len(score_tcc(...).recommendations) == 7` and `quarantined == []`.  
4. Grep gate: `rg "for drug in PASS_DRUGS" services/tcc_scorer.py` returns **no matches**.  
5. Grep gate: `rg "QUARANTINE IS FINAL" services/chat_agent.py` returns **no matches**.  
6. PR description lists the 7 scores for BRAF+ Scottish (table). No “we still quarantine but…” language.

---

## Out of scope (do not do in this PR)

- Sourcing new PK literature / changing `pk_status` to VERIFIED for other drugs  
- Expr UI / gene-panel remap  
- Frontend HowItWorks / `tsc`  
- `recipe_node` TypeError  
- Durable DB / ML training  

Those are separate tasks. Completing H1 does **not** require them.

---

## Copy-paste kickoff prompt for the implementing agent

```
Implement AGENT TASK H1 only from docs/AGENT_TASK_H1_FULL_PANEL_SCORE.md
(or the same text in the task brief).

Repo: fjkiani/vetonco-backend.
Deliverable: score_tcc scores all DRUG_PANEL drugs; PK incompleteness is
INCOMPLETE_PK / fields, not omission or score=0 quarantine list.

Follow Exact code changes + Required new assertions exactly.
Forbidden sandbags are automatic failure.
Run pytest tests/ -v until green.
Do not touch frontend. Do not invent PK/ORR numbers.
Open a PR whose body includes the BRAF+ Scottish 7-drug score table.
```
