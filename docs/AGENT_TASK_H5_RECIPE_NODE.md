# AGENT TASK H5 — recipe_node TypeError + JSON recipe (one deliverable)

**Repo:** `https://github.com/fjkiani/vetonco-backend` (NOT canine-oncology)  
**Branch naming:** `cursor/h5-recipe-node-<suffix>` off that repo’s `main` (or rebase onto merged H1 / `cursor/h1-full-panel-score-80c5` if H1 not yet on `main`)  
**Depends on:** H1 full-panel score (so dosing sees a real top-3). If H1 is unmerged, base the implementing PR on the H1 branch.  
**Scope:** Pipeline recipe node + serialization only. **Do not** “fix” this with docs, HowItWorks edits, FE `tsc`, or new recipe-generator modules.

---

## Why this is next (after H1) — evidence, not vibes

| Candidate | Blocker class | Verdict |
|-----------|---------------|---------|
| **H5 recipe_node** | **Broken path:** `d["drug"]` on `PharmacistDrugEntry` → TypeError; exception swallowed → `recipe=null`, `complete=False`. Second bug: even a successful card embeds raw dataclasses → `json.dumps` fails. | **PICK.** Existing generator works (Angus/Bella/Maisie integration tests green). Companion agent path cannot finish with a recipe. No new science. |
| H3 HowItWorks/ORR | User-visible lie (Gustafson 6.7% / sensitivity 0.64 vs BE Bernabe 0.26 / score 0.380; “7 PASS”) | Important honesty, but does **not** unblock analyze→recipe. Needs ORR adjudication + FE. |
| H6 FE type contract | 32 `tsc` errors; UI reads `ranked_drugs` / `fit_score` | Needed for display, but pipeline still fails before FE can show a recipe. |
| H2 PK dossiers | Science / literature | Explicitly deferred: inventing/sourcing PK is out of H1/H5. |

**Live proof (H1 branch `022ca6b`, 2026-11-28):**

```
generate_recipe_card OK drugs=['toceranib'] type=PharmacistDrugEntry
recipe_node errors=["recipe_node: 'PharmacistDrugEntry' object is not subscriptable"]
recipe_data is None: True
build_pipeline_result recipe.drugs[0] type=PharmacistDrugEntry
JSON TypeError: Object of type PharmacistDrugEntry is not JSON serializable
after score→dosing→recipe: complete=False recipe=None
```

Broken line: `agents/tcc_pipeline_agent.py` ~219  
`[d["drug"] for d in card.drugs]` — `card.drugs` is `list[PharmacistDrugEntry]` (dataclass), not dicts.  
Working pattern already in-repo: `routers/canine.py` `/tcc/recipe` uses `[_asdict(d) for d in card.drugs]` + `pdf_b64`. **Reuse that; do not invent a new serializer.**

---

## Goal (one sentence)

`recipe_node` must succeed with attribute access on `PharmacistDrugEntry`, and every pipeline result that exposes `recipe` must be **JSON-serializable** with string drug names so Angus/Bella/Maisie sync paths can return `complete=True` with a real recipe (when upstream score/dose/LLM succeed).

---

## Forbidden sandbags (instant fail)

- Leaving `d["drug"]` (dict access) on `PharmacistDrugEntry` anywhere in `recipe_node` / pipeline recipe preview.
- Catching the TypeError and marking the node `ok` / clearing `errors` without a real `recipe_data`.
- Returning `complete=True` while `recipe` is `null` after dosage_data was non-empty.
- Embedding raw `PharmacistDrugEntry` / `RecipeCard` objects in API JSON (must be `asdict` / plain dicts; `pdf_bytes` → `pdf_b64` or omit).
- Shipping only a markdown explanation or a new wrapper module that still calls `d["drug"]`.
- Rewriting `generate_recipe_card` / inventing new dose or ORR numbers.
- Touching frontend / HowItWorks / Landing / H3 ORR sync in this task.
- Claiming the pipeline is “done” because `/tcc/recipe` (standalone) already works — the **agent** path is what is broken.
- Skipping serialization fix in `build_pipeline_result` and/or `routers/canine.py` `/tcc/pipeline` recipe step while only patching the preview line.

---

## Exact code changes

### 1. `agents/tcc_pipeline_agent.py` → `recipe_node`

- Change preview extraction from dict access to attribute access:

  **Broken:** `"drugs": [d["drug"] for d in card.drugs]`  
  **Required:** `"drugs": [d.drug for d in card.drugs]`

- Keep `generate_recipe_card(...)` call as-is (same kwargs). Do not reimplement the pharmacist card.
- On success: `recipe_data` must be the `RecipeCard` instance; trace `status="ok"`; **no** `recipe_node:` entry in `errors`.
- Do not broaden the bare `except` into a soft-skip that reports success.

### 2. `agents/tcc_pipeline_agent.py` → `build_pipeline_result`

- Serialize recipe with the same pattern as `/tcc/recipe`:

  ```python
  "recipe": {
      "drugs": [dc_asdict(d) for d in recipe_data.drugs],
      "interactions": recipe_data.interactions,
      "monitoring": recipe_data.monitoring,
      "printable_text": recipe_data.printable_text,
      # optional but preferred: pdf_b64 if pdf_bytes present; never put raw bytes in JSON
  } if recipe_data else None
  ```

- `json.dumps(build_pipeline_result(state))` must succeed when `recipe_data` is set.
- `complete` remains `len(errors) == 0` — after the TypeError fix, a score→dose→recipe happy path must not inject a recipe error.

### 3. `routers/canine.py` → `POST /tcc/pipeline` recipe step (~335–340)

- Same bug class: `"drugs": card.drugs` embeds dataclasses.
- Required: `"drugs": [asdict(d) for d in card.drugs]` (module already imports `asdict`).
- Standalone `POST /tcc/recipe` already correct — leave it unless a rename forces a touch; do not regress `pdf_b64`.

### 4. Minimal new code allowed

- Prefer **zero** new modules.
- Allowed: tiny helper e.g. `serialize_recipe_card(card) -> dict` in `recipe_generator.py` **only if** both call sites share it; otherwise inline `asdict` at the two sites.
- Do not add a second recipe generator, mock card factory for production, or quarantine-related fields.

### 5. Downstream (minimal)

- `routers/agent.py` SSE `complete` event uses `build_pipeline_result` — fixing that function is enough.
- Do not change dosing math, scorer, or chat quarantine policy in this task.

---

## Tests you must add / rewrite

File: prefer new `tests/test_pipeline_recipe.py` (or extend `tests/test_integration.py` if you keep it tiny). **Integration tests today call `generate_recipe_card` directly and never hit `recipe_node` — that is why CI stayed green while the agent path is dead.**

### Required assertions (non-gameable)

```python
import json
from agents.state import initial_tcc_state
from agents.tcc_pipeline_agent import score_node, dosing_node, recipe_node, build_pipeline_result
from services.recipe_generator import PharmacistDrugEntry

def test_recipe_node_attribute_access_angus():
    """Fails if d['drug'] is restored or exception is soft-swallowed."""
    state = initial_tcc_state(
        pet_name="Angus", breed="scottish terrier", weight_kg=12.0,
        braf_status="positive", prescribing_vet="Dr. Smith DVM DACVIM",
        creatinine_mg_dl=1.8,
    )
    state = score_node(state)
    state = dosing_node(state)
    assert state.get("dosage_data"), "dosing must produce rows before recipe"
    state = recipe_node(state)
    assert not any(str(e).startswith("recipe_node:") for e in state.get("errors", []))
    card = state["recipe_data"]
    assert card is not None
    assert all(isinstance(d, PharmacistDrugEntry) for d in card.drugs)
    names = [d.drug for d in card.drugs]
    assert "toceranib" in names
    by = {d.drug: d for d in card.drugs}
    # Exact Angus toceranib dose anchors (same as test_integration.TestAngus)
    assert by["toceranib"].final_dose_mg == 33.0
    assert by["toceranib"].concentration_mg_ml == 10.0
    assert by["toceranib"].vehicle == "Ora-Plus/Ora-Sweet 1:1"
    assert by["toceranib"].beyond_use_date_days == 60
    assert by["toceranib"].pk_status == "VERIFIED"
    trace = state["trace"][-1]
    assert trace.status == "ok"
    assert trace.node == "recipe_node"
    assert "toceranib" in trace.output_preview["drugs"]

def test_build_pipeline_result_recipe_json_safe():
    state = initial_tcc_state(
        pet_name="Angus", breed="scottish terrier", weight_kg=12.0,
        braf_status="positive", prescribing_vet="Dr. Smith DVM DACVIM",
        creatinine_mg_dl=1.8,
    )
    state = score_node(state)
    state = dosing_node(state)
    state = recipe_node(state)
    result = build_pipeline_result(state)
    assert result["recipe"] is not None
    assert isinstance(result["recipe"]["drugs"][0], dict)
    assert result["recipe"]["drugs"][0]["drug"] == "toceranib"
    # Must be JSON-serializable (kills raw dataclass embed)
    payload = json.dumps(result)
    assert "toceranib" in payload
    assert result["complete"] is True or (
        # If llm_node not run, complete may still be True when errors==[]
        len(result["errors"]) == 0
    )
    assert len(result["errors"]) == 0

def test_cannot_hide_behind_dict_access():
    """Static guard: recipe_node must not use d['drug'] on card.drugs."""
    import pathlib
    src = pathlib.Path("agents/tcc_pipeline_agent.py").read_text()
    assert 'd["drug"] for d in card.drugs' not in src
    assert "d['drug'] for d in card.drugs" not in src
```

### Also required

- Assert `POST /tcc/pipeline` recipe step (if unit-tested via building the recipe dict helper) never returns a list of `PharmacistDrugEntry` instances — only dicts. If you cannot hit FastAPI easily, a pure function test on the serialized shape is enough **plus** a grep gate below.
- Do **not** delete Angus/Bella/Maisie `generate_recipe_card` tests; keep dose anchors `33.0` / `68.75` / `22.0`.

### Optional but strong

- Mock-free: after `recipe_node` success, `json.dumps(trace[-1].output_preview)` succeeds (preview must be plain data).

---

## Acceptance (all required)

```bash
cd vetonco-backend
# Prefer H1 branch if not merged:
# git fetch origin cursor/h1-full-panel-score-80c5 && git checkout ...
python -m pytest tests/ -v
```

1. **Exit 0** (including new pipeline recipe tests).  
2. `test_recipe_node_attribute_access_angus` passes with **exact** toceranib `final_dose_mg == 33.0`.  
3. `test_build_pipeline_result_recipe_json_safe` — `json.dumps` succeeds; `recipe.drugs[0]` is `dict` with `"drug": "toceranib"`.  
4. Grep gate: `rg 'd\["drug"\] for d in card\.drugs' agents/tcc_pipeline_agent.py` returns **no matches**.  
5. Grep gate: `rg '"drugs": card\.drugs' routers/canine.py` returns **no matches**.  
6. Manual/script proof in PR body: score→dosing→recipe on Angus yields `recipe_data` non-null and `errors` with no `recipe_node:` prefix.  
7. PR description states that `/tcc/recipe` was already correct; the fix is the **agent/pipeline** path — no credit for only re-documenting the standalone endpoint.

---

## Why lazy output fails

| Lazy agent move | Acceptance check that kills it |
|-----------------|--------------------------------|
| “Only docs / explain the TypeError” | No green `test_recipe_node_*`; pytest gate fails. |
| Soft-catch TypeError, set `status=ok`, leave `recipe_data=None` | `assert card is not None` + `complete`/`errors` assertions fail. |
| Fix preview to `d.drug` but leave `build_pipeline_result` embedding dataclasses | `json.dumps(result)` / `isinstance(..., dict)` fails. |
| Fix agent path only; leave `canine.py` `"drugs": card.drugs` | Grep gate `"drugs": card.drugs` fails. |
| Claim done because `/tcc/recipe` + existing integration tests pass | New tests call `recipe_node` / `build_pipeline_result` — old tests never did. |
| Rewrite `generate_recipe_card` or change dose to make tests pass | Exact `33.0` / vehicle / BUD anchors fail; out-of-scope. |
| Return `complete=True` while stuffing empty recipe `{}` | `toceranib` name + `final_dose_mg` assertions fail. |
| New shell module that still does `d["drug"]` | Grep gate on `tcc_pipeline_agent.py` + attribute test fail. |

---

## Out of scope (do not do in this PR)

- HowItWorks / Landing / ORR SOT (H3)  
- FE `tsc` / `ranked_drugs` → `recommendations` (H6)  
- PK dossier sourcing / changing `pk_status` (H2)  
- Durable DB, RAG expansion, ML  
- Inventing PK/ORR numbers  
- Changing scorer formula or re-quarantining  

Completing H5 does **not** require those.

---

## Copy-paste kickoff prompt for the implementing agent

```
Implement AGENT TASK H5 only from docs/AGENT_TASK_H5_RECIPE_NODE.md
(or the same text in the task brief).

Repo: fjkiani/vetonco-backend.
Base on merged main if H1 is merged; otherwise branch from
cursor/h1-full-panel-score-80c5.

Deliverable: recipe_node uses PharmacistDrugEntry.attribute access
(d.drug not d["drug"]); build_pipeline_result and /tcc/pipeline
serialize recipe drugs via asdict so json.dumps works; Angus path
gets non-null recipe without recipe_node errors.

Follow Exact code changes + Required new assertions exactly.
Forbidden sandbags are automatic failure.
Reuse /tcc/recipe asdict pattern — do not invent a new generator.
Run pytest tests/ -v until green.
Do not touch frontend / HowItWorks / ORR / PK numbers.
Open a PR whose body includes the live Angus recipe_node proof
(errors empty, drug names, final_dose_mg=33.0).
```
