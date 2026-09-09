# 10-minute demo script (synthetic data)

1. Sticky header: **Analyse starten** / **Export**. KI-Kugel unten rechts.
2. Architecture one-liner: deterministic rules own severity; AI explains with citations.
3. Click **Analyse starten** → KPI-Kacheln (**Standorte**, **Befunde**, **Kritisch**, **SLA-Risiko**).
4. Chip **Kritisch** → click **DE-NRW-0107** (opens `/befund/:id`):
   - Vertragsfälligkeit 2026-09-15
   - Forecast 2026-09-20 → SLA-001
   - Integration vor Fibre-Ready → SEQ-002
5. Inspektor **Quellzellen**: Datei / Blatt / Zeile / Spalte.
6. **KI erklären** → Zusammenfassung + nächster Schritt + Evidenz-Chips.
7. **Agent-Kugel** unten rechts — Chip oder Freitext.
8. **Freigeben / Verwerfen** (zweiter Klick bestätigt); **Export**.
9. Optional: `LLM_ENABLED=false`, Erklärung erneut — Mock bleibt.
10. Abschluss: Wert-Hypothese + „Welchen echten Workbook-Schmerz sollten wir zuerst validieren?“

Reset before demo: `.\scripts\demo-reset.ps1`
