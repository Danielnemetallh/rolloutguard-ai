# 10-minute demo script (synthetic data)

1. Banner: "Independent prototype — fictional partners/sites/rules."
2. Architecture one-liner: deterministic rules own severity; AI explains with citations.
3. Click **Run synthetic analysis** → show KPI cards.
4. Filter Critical → open **DE-NRW-0107**:
   - contract due 2026-09-15
   - forecast 2026-09-20 → SLA-001
   - planned integration before fibre-ready → SEQ-002
5. Evidence drawer: file / sheet / row / column.
6. **AI explain** → grounded summary + next action (does not change severity).
7. **Ask agent: September risks** → show tool_trace + site list.
8. Approve/Dismiss with reason; optionally **POST /exports**.
9. Optional: set `LLM_ENABLED=false`, re-run explain → mock still works.
10. Close with value hypothesis + "which real workbook pain should we validate first?"
