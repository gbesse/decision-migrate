# AI change log

Purpose: Record implementation decisions and validation for this independent product.

## 2026-09-21 — Initial alpha

Implemented exact-model-only Dify classifier migration, baseline probes with an explicit call budget and deadlines, local persisted application, YAML safeguards and browser/API contracts. Reuses DecisionPacks and Workbench. Four tests including Chromium pass; no Dify runtime execution or paid calls.

A bounded four-call verification across the launch apps succeeded against Jev 1.13.0 on synthetic inputs. See `docs/live-verification.json` for exact scope; this is not a model benchmark or host certification.
