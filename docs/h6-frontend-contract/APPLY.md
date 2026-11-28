# H6 — Frontend type/API contract (apply to vetonco-frontend)

**Target repo:** https://github.com/fjkiani/vetonco-frontend  
**Branch:** `cursor/h6-fe-contract-80c5`  
**Depends on:** backend H1 + H5 (`recommendations` / `score`, PharmacistDrugEntry JSON) — [backend PR #1](https://github.com/fjkiani/vetonco-backend/pull/1), [PR #2](https://github.com/fjkiani/vetonco-backend/pull/2)

## Why this mirror exists

The implementing agent finished the work locally on `vetonco-frontend` (`78d9e53`) but **could not push** (`cursor[bot]` 403 — no Contents write on that repo). Apply the patch once Cursor has write access, or manually.

```bash
cd vetonco-frontend
git checkout master
git checkout -b cursor/h6-fe-contract-80c5
git am /path/to/0001-h6-fe-contract.patch   # or: git apply
npm install
npm run check   # typecheck + vitest contract
```

## Real gates

```bash
npm run typecheck        # tsc -p tsconfig.app.json --noEmit
npm run test:contract    # vitest analyzeContract tests
npm run check            # both
```

### Mutate proof (already run)

Temporarily making `getDrugScore` prefer `fit_score` caused:

`fails getDrugScore on fit_score-only rows` → **FAIL** (expected throw missing).

Restored → **10 passed**, `tsc` exit 0.

## Contract changes (summary)

| Old (v1 UI) | New (H1/H5) |
|-------------|-------------|
| `score_result.ranked_drugs` | `recommendations` (len 7) |
| `fit_score` | `score` |
| `quarantine_drugs` | `quarantined` (empty) |
| `dosage_data` / `recipe_data` / `chembl_data` / `rationale_text` | `dosages` / `recipe` / `compounds` / `rationale` |
| recipe drugs `dose_mg`/`frequency` | PharmacistDrugEntry `final_dose_mg`/`schedule` + H5 fields |
