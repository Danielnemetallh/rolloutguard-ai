# RolloutGuard AI — Interview-Leitfaden

> **Zweck:** Dieses Dokument hilft dir, das Projekt in 10–15 Minuten strukturiert vorzustellen.  
> **Wichtig vorab:** Unabhängiger Prototyp mit **fiktiven** Partnern, Sites und Regeln — kein Produktivsystem.

---

## 1. Elevator Pitch (30 Sekunden)

**RolloutGuard AI** vergleicht drei Excel-Quellen (Vertrag, Partner-Plan, Site-Status), erkennt Widersprüche und Verstöße gegen Meilenstein-Logik, und liefert eine **priorisierte Exception-Queue** mit Zell-Level-Nachweisen.

**Kernbotschaft:**

> „Die **Regeln** entscheiden über Schweregrad und Befund — nicht das LLM. Die KI erklärt nur, was die deterministische Engine bereits gefunden hat.“

---

## 2. Welches Problem löst es?

| Quelle | Inhalt |
|--------|--------|
| **Contract** | Vertragliche Fälligkeit, Partner, SLA-Tage |
| **Schedule** | Geplant / Forecast / Ist-Integration |
| **Status** | Permit, Bau, Fibre-Ready, Integrationstest |

Typische Schmerzpunkte: unterschiedliche Spaltennamen, Forecast nach Vertragsfrist (SLA-001), Integration vor Fibre-Ready (SEQ-002), fehlende Quellen (DQ-002).

---

## 3. Architektur

```
Excel (3 Workbooks) → Ingest/Mapping → Reconcile → Rules (11) → Findings + Evidence
                                                              ↓
                                              UI + AI (Explain, read-only Agent)
```

**Design-Prinzip:** Deterministic core, AI at the edges.

---

## 4. Die 11 Regeln (Auswahl)

| ID | Bedeutung |
|----|-----------|
| **SLA-001** | Forecast/Ist nach Vertragsfälligkeit → **SLA risk** KPI |
| **SEQ-002** | Integration vor Fibre-Ready |
| **DQ-002** | Site fehlt in Pflichtquelle |
| **FRS-001** | Quelldaten älter als 30 Tage |

Vollständige Liste: `backend/src/rolloutguard_api/domain/schema.py`

---

## 5. Hero-Demo: DE-NRW-0107

| Feld | Wert |
|------|------|
| Vertragsfälligkeit | 2026-09-15 |
| Forecast | 2026-09-20 → **SLA-001** |
| Fibre-Ready | 2026-09-18, Integration davor geplant → **SEQ-002** |

---

## 6. Live-Demo (10 Min)

```powershell
.\scripts\demo-reset.ps1    # optional
.\scripts\dev-api.ps1       # Terminal 1
.\scripts\dev-web.ps1       # Terminal 2
```

→ http://localhost:5173

1. **Run synthetic analysis**
2. Filter **Critical** → **DE-NRW-0107**
3. Evidence Drawer → **AI explain**
4. **Ask agent** (Freitext)
5. **Approve / Dismiss** → **Export**

Details: [DEMO.md](./DEMO.md)

---

## 7. Typische Interview-Fragen

**„Ist das nur ein LLM-Wrapper?“**  
Nein — `services/rules.py` erzeugt alle Befunde. LLM bekommt nur Evidence-Pakete.

**„Warum kein RAG?“**  
Strukturierte Reconciliation reicht fürs MVP. RAG kommt für Vertrags-PDFs/SOWs (pgvector vorgesehen).

**„Was als Nächstes?“**  
Upload-UI, Mapping-Review-Screen, RAG über echte Dokumente.

---

## 8. Grenzen (ehrlich benennen)

- Nur synthetische Daten
- Kein Writeback in Partner-Excel
- Kein Produktions-Auth (Demo-Identity)
- Header-Mapping-UI noch ausstehend (Backend vorhanden)

---

## 9. Abschluss-Satz

> „RolloutGuard ist ein deterministisches Reconciliation-Tool mit Evidence Lineage — die KI erklärt und liest, ersetzt aber nie die fachliche Bewertung.“
