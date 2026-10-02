# Decision Migrate

Inspect a Dify classifier workflow, prepare a reviewable Jev migration, and compare recorded baseline categories against bounded Jev probes. Open-source alpha; independent of TypeSafe and Dify.

## Run

Node 24 or later. `npm ci --ignore-scripts`, then `npm run demo`. Open the private loopback URL printed by the server. For real comparisons, set `TYPESAFE_API_KEY` server-side and run `npm start`. The demo is explicitly synthetic and always picks the first category. No API key is needed to inspect or export a migration.

## Workflow

1. Upload Dify DSL YAML or JSON (version **0.3.1**).
2. Select an eligible text Chat `question-classifier` node.
3. Inspect the JSON Patch and download the modified YAML. Only the selected `data.model` is changed; category IDs, edges, instructions, input selector and unrelated nodes remain intact.
4. Install/configure the official TypeSafe provider in Dify, inspect the exported workflow, and import it into your test instance.
5. Supply observed baseline `{query,baseline,latencyMs?}` cases and compare them with Jev before switching real traffic.

Comparison runs an independent DecisionPack probe against recorded baseline outcomes. It does **not** execute the original LLM or reproduce Dify's full prompt protocol. Savings are not claimed: absent latency/cost observations remain absent. Up to 20 calls and an 85-second overall comparison deadline; rows not attempted after expiry are marked explicitly. Individual calls have a 30-second timeout.

## Inspect a minimal migration patch offline

`npm run demo:patch` reads the bundled synthetic Dify classifier, creates a reviewable patch and asserts that category IDs and graph edges remain identical. It does not start Dify, call Jev or import the modified workflow. Review the patch and test it in your target Dify version before switching traffic.

## Supported subset and verification

Text Chat classifiers, literal instructions, 2–255 unique finite categories, two-part input selectors. Memory, vision, templated instructions, malformed classes and unsupported DSL versions are rejected. Plugin dependency hashes are never guessed or rewritten; the official provider must be installed separately.

`npm test` covers exact graph preservation/YAML roundtrip, rejection paths, comparison validation and a real Chromium import → patch download → comparison journey. `npm run check` checks syntax. CI runs both without a build or paid inference. Dify itself has **not** been started in these tests: host-import and exact Graphon prompt compatibility require validation in your target Dify version.

## Reuse

Uses DecisionPacks for validated finite inference and Decision Workbench for its authenticated local server and SQLite persistence. All Git dependencies are pinned by commit. State persists under `.local/`; compare reports and failures remain inspectable in SQLite. Do not expose this loopback server as a public web service. Source workflows can contain secrets; inspect before sharing exported files.

## Primary references

- [Official TypeSafe provider implementation](https://github.com/langgenius/dify-official-plugins/tree/main/models/typesafe_ai).
- [Dify classifier contract](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/question-classifier/types.ts).
- [Dify DSL fixture](https://github.com/langgenius/dify/blob/main/api/tests/fixtures/workflow/basic_chatflow.yml).

Reviewed 2026-09-21. Compatibility claims are limited to the subset tested above.

A real Jev smoke verification is recorded in [docs/live-verification.json](docs/live-verification.json). It used only synthetic examples and made no store/workflow changes.
