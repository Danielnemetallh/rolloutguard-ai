# Kaggle construction fixture

This fixture is derived from the downloaded Kaggle files:

- `Construction_Data_PM_Forms_All_Projects.csv`
- `Construction_Data_PM_Tasks_All_Projects.csv`

Source page: <https://www.kaggle.com/datasets/claytonmiller/construction-and-project-management-example-data>

The Kaggle page identifies the source as `CC BY-NC-SA 4.0`. Keep the attribution with any redistribution. The original CSVs remain outside the repository in `C:\Users\Dania\Downloads\archive\` and are not copied or modified by the adapter.

## Derived files

The three `.xlsx` files use the canonical RolloutGuard fields and can be supplied to the existing upload endpoint as contract, schedule, and status inputs. Source project IDs are converted to stable fixture site IDs `KAGGLE-DE-<project>`. Partner IDs are deterministic test assignments, not source facts.

Dates, contractual due dates, SLA values, fibre readiness, integration-test status, acceptance status, and some milestone/status values are derived fixture assumptions. They exist to exercise mapping, reconciliation, missing evidence, stale data, status mismatch, and rule evaluation. They must not be interpreted as facts from the Kaggle source.

Regenerate with:

```powershell
python scripts/adapt-kaggle-construction.py `
  --forms C:\Users\Dania\Downloads\archive\Construction_Data_PM_Forms_All_Projects.csv `
  --tasks C:\Users\Dania\Downloads\archive\Construction_Data_PM_Tasks_All_Projects.csv `
  --output data\fixtures\kaggle_construction
```
