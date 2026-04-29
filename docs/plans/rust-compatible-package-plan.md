# Rust-Compatible Package Plan

Goal: move `ui-grid` to a single Rust core that Angular, React, and
web-component outputs consume, while giving Rust developers first-class
packages they can adopt directly.

This plan focuses on **packaging and distribution mechanics** for that target
architecture — what we publish, where, under what name, and in what order — so
that Rust consumers (CLI tools, native frontends, server-side renderers,
codegen pipelines) can depend on us cleanly while the existing JS-facing
packages converge on the same Rust engine.

The seam split is already in place (`grid.core.*`, `ui-grid.events.ts`,
`ui-grid.state.ts`, `ui-grid.commands.ts`, `ui-grid.host.ts`), so a
framework-neutral engine surface already exists in TypeScript. That is the
contract we freeze, mirror in Rust, and then use to retire the TypeScript core
instead of maintaining it indefinitely.

## Target Architecture

The desired steady state is:

- `ui-grid-core` in Rust is the only maintained implementation of grid logic
- Angular, React, and web components call the Rust core through a stable JS/WASM boundary
- a future Rust-native adapter exposes the same mental-model API on top of that same core

The desired steady state is not a permanent JavaScript engine plus a permanent
Rust engine. Dual maintenance is a migration cost, not a product strategy.

---

## Audiences and Use Cases

| Audience | What they need | Distribution channel |
| --- | --- | --- |
| Rust web apps using a JS bridge (Tauri webview, Dioxus web, Leptos web) | An `npm` package that works with `wasm-bindgen` JS glue or a plain `<script>` build | npm: `@ornery/ui-grid` (existing) |
| Rust native frontends (Dioxus desktop, Leptos with SSR, egui) | A pure-data engine they can call from Rust without a JS runtime | crates.io: `ui-grid-core` (future) |
| Rust backends (loco.rs, axum, actix) doing SSR or CSV export | A library callable from server Rust with no DOM | crates.io: `ui-grid-core` (future) |
| Mixed Node + Rust toolchains (build pipelines, codegen) | A native Node addon callable from JS, implemented in Rust | npm: `@ornery/ui-grid-native` (future, napi-rs) |
| Anyone who just wants the schema | JSON Schema / TypeScript declarations / Rust `serde` types | published alongside each package |

The order we ship them matches the ROI and the migration path:

1. **Schema package** (cheap, immediate value).
2. **WASM-friendly npm build** (cheap, unlocks Tauri/Dioxus-web today).
3. **`ui-grid-core` crate on crates.io** (medium, unlocks native Rust).
4. **`ui-grid-wasm` crate + npm package** (medium, becomes the engine used by Angular, React, and web components).
5. **napi-rs Node addon** (optional, only if profiling demands it).

---

## Phase A — Publish a Stable Engine Contract (Schema-First)

Before any Rust code exists, lock the boundary so Rust and TypeScript agree on
shapes.

### Deliverables

- `projects/ui-grid/src/lib/grid/grid.contracts.ts` re-export of the engine
  types already defined in `grid.core.types.ts`:
  - `GridOptionsSnapshot`
  - `GridColumnSnapshot`
  - `GridStateSnapshot`
  - `GridCommand`
  - `GridPipelineRequest` / `GridPipelineResult`
  - `GridSaveStateResult`
  - `GridCsvExportResult`
- A generated **JSON Schema** for each contract type, emitted by a new
  `scripts/emit-engine-schema.mjs` using `ts-json-schema-generator`.
- A generated **`serde`-compatible Rust module** (`ui-grid-contracts/src/lib.rs`)
  produced from the same JSON Schema via `typify` or `schemafy`.
- Schema artifacts published as part of the existing `dist/npm-package` under
  `schema/*.json` and as a separate `crates/ui-grid-contracts` crate later.

### Discipline

- No callbacks, no template refs, no `Function`-typed fields cross the boundary.
- Every breaking schema change bumps the package's `engineContractVersion`
  field (added to `package.json` and to the crate's `Cargo.toml` metadata).
- CI runs a `schema-diff` step that fails if `dist/npm-package/schema/*.json`
  changes without a contract-version bump.

### Exit criteria

- `npm run build:package` produces `dist/npm-package/schema/*.json`.
- A throwaway Rust binary can `serde_json::from_str` a fixture produced by the
  TS engine into the generated Rust types.

---

## Phase B — Make the Existing npm Package WASM-Friendly

The current `full` preset is the only published flavor. Rust web consumers
(Dioxus-web, Leptos-web, Tauri, Yew) will pull it through `wasm-bindgen`'s JS
interop. We need it to behave well in that environment.

### Deliverables

- Verify the `dist/npm-package` build has:
  - `"sideEffects": false` where true.
  - An ES module entry plus a UMD/IIFE bundle for non-bundler consumers.
  - No Node-only imports in the browser entry.
- Add a `dist/npm-package/rust/README.md` with:
  - A minimal `wasm-bindgen` snippet importing the engine helpers.
  - A Tauri `invoke`-style example for desktop Rust.
  - A note that DOM APIs require a browser runtime (rules out pure server use
    of the JS build — that is what `ui-grid-core` will solve).
- Add a smoke test in `examples/rust-web/` (a tiny Dioxus or Leptos web app)
  that imports the npm package and renders a grid via the web component bundle
  produced by `npm run build:element`.

### Exit criteria

- A Rust web example consumes the published npm tarball and renders a grid.
- The web component build (`dist/ui-grid-element/`) is documented as the
  recommended entry point for non-Angular Rust consumers.

---

## Phase C — Cargo Workspace Skeleton

This is the structural prerequisite for shipping anything *to* Rust users.

### Deliverables

- Root `Cargo.toml` declaring a workspace.
- `crates/ui-grid-contracts/` — `serde` types + JSON Schema parity tests.
- `crates/ui-grid-fixtures/` — the canonical fixture corpus from
  `rust-approach-plan.md` Phase 1, embedded as static JSON for parity testing.
- `crates/ui-grid-core/` — empty stub with the public API surface declared
  (functions return `todo!()` initially).
- `crates/ui-grid-wasm/` — empty stub.
- `.github/workflows/rust.yml` running `cargo fmt --check`, `cargo clippy
  --all-targets --all-features -D warnings`, and `cargo test` on stable Rust.
- `rust-toolchain.toml` pinning the toolchain.

### Discipline

- The TypeScript build does not depend on Rust. Rust CI is independent.
- The Cargo workspace does **not** vendor `node_modules` and is not part of any
  `npm` workspace.

### Exit criteria

- `cargo check --workspace` is green on a clean clone.
- Rust CI runs on every PR but does not block the JS publish pipeline yet.

---

## Phase D — Publish `ui-grid-contracts` to crates.io

First crate published. It carries no logic, only types, and is therefore safe
to release early and iterate on.

### Deliverables

- `crates/ui-grid-contracts/Cargo.toml` with metadata:
  - `license = "MIT"` (match the npm package license).
  - `repository`, `documentation`, `readme`, `keywords`, `categories`.
  - `engineContractVersion` recorded in `package.metadata.ui-grid`.
- A `cargo publish --dry-run` step in CI on tagged releases.
- A manual `cargo publish` step gated on a maintainer-approved environment in
  the GitHub Actions release workflow, mirroring how npm publish is gated.
- A parity test in `crates/ui-grid-contracts/tests/parity.rs` that loads the
  JSON Schema bundled with the npm package and asserts every Rust type
  round-trips a fixture from `ui-grid-fixtures`.

### Exit criteria

- `cargo add ui-grid-contracts` works for an external Rust user.
- The crate's docs.rs page documents every public type.

---

## Phase E — Implement `ui-grid-core` in Rust

This is the engine port described in `rust-approach-plan.md`. From a
**packaging** standpoint, the deliverables are:

- `crates/ui-grid-core/Cargo.toml` with `categories = ["data-structures",
  "no-std::no-alloc"]` only if we land a `no_std` build (stretch goal); start
  with `std` only.
- A `default-features = []` design so server consumers can opt into only the
  pipeline they need (`features = ["filtering", "sorting", "grouping",
  "tree", "pagination", "csv-export", "save-state"]`).
- Published to crates.io with the same `engineContractVersion` as
  `ui-grid-contracts` it depends on.

### Discipline

- No `wasm-bindgen` dependency in this crate — that lives in `ui-grid-wasm`.
- No platform-specific code. `cargo check --target x86_64-unknown-linux-gnu`
  and `--target wasm32-unknown-unknown` must both pass.

### Exit criteria

- A loco.rs or axum example service can render a sorted/filtered grid view
  model entirely in Rust, with no JavaScript runtime in the loop.

---

## Phase F — Switch Existing JS Outputs to the Rust Core

This is the step that turns Rust from an optional extra into the product's
actual engine.

### Deliverables

- `ui-grid-wasm` exists as the internal JS/WASM boundary used by the adapters,
  even if it is not yet published as a standalone external package.
- Angular calls the Rust engine for pipeline execution, state transitions,
  save-state, and export transforms.
- React consumes the same JS/WASM boundary instead of a separate JS engine.
- The web-component output consumes the same JS/WASM boundary instead of a
  separate JS engine.
- The existing TypeScript engine remains only as a gated fallback during the
  migration window.
- A parity harness runs the same fixture corpus through:
  - the legacy TypeScript engine
  - the Rust core via JS/WASM
  - the Rust core directly in Rust

### Discipline

- No new engine behavior lands in TypeScript once this phase starts.
- Any bug fixed in the fallback TypeScript path must be fixed in Rust first.
- Public adapter APIs stay stable; only the implementation behind them changes.

### Exit criteria

- Angular, React, and web components all use the Rust core by default.
- The TypeScript engine is no longer the primary path for any shipped package.

---

## Phase G — Publish `ui-grid-wasm` to Both Ecosystems

By this point the JS-facing adapters already depend on `ui-grid-wasm`
internally. This phase makes that boundary a supported external artifact with
**two publishing channels**:

### Channel 1: crates.io

- `crates/ui-grid-wasm/` published as a normal crate so other Rust crates can
  depend on the boundary helpers (mostly serialization shims).

### Channel 2: npm via `wasm-pack`

- `wasm-pack build crates/ui-grid-wasm --target web --out-dir
  pkg/ui-grid-wasm-web` for browsers and Tauri webviews.
- `wasm-pack build crates/ui-grid-wasm --target nodejs --out-dir
  pkg/ui-grid-wasm-node` for Node SSR and tooling.
- `wasm-pack build crates/ui-grid-wasm --target bundler --out-dir
  pkg/ui-grid-wasm-bundler` for webpack/Vite/Rollup users.
- Combine the three under a single npm package
  `@ornery/ui-grid-engine-wasm` using the standard `wasm-pack` multi-target
  layout (`web/`, `node/`, `bundler/` subpaths exposed via `exports`).

### Versioning rule

`@ornery/ui-grid-engine-wasm@x.y.z` MUST track
`ui-grid-wasm@x.y.z` on crates.io for the same git SHA. The release workflow
publishes both atomically or not at all.

### Discipline

- The npm package ships `.wasm` plus generated `.d.ts`. No bundler-specific
  preprocessing.
- SRI hashes for the `.wasm` file are published in the package's
  `package.json` `wasmIntegrity` field for CSP-strict consumers.

### Exit criteria

- `npm install @ornery/ui-grid-engine-wasm` and `cargo add ui-grid-wasm` give
  byte-identical engine behavior for the fixture corpus.

---

## Phase H — Optional: napi-rs Node Addon

Only if profiling shows the WASM boundary is the bottleneck for Node-side
SSR or build-time CSV export.

### Deliverables

- `crates/ui-grid-napi/` using `napi-rs`.
- Published as `@ornery/ui-grid-native` with prebuilt binaries for
  `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`,
  `win32-x64-msvc` via `napi-rs`'s GitHub Actions matrix.
- A JS fallback to `@ornery/ui-grid-engine-wasm` when no prebuilt binary
  matches the host triple.

### Exit criteria

- `npx @ornery/ui-grid-native --selftest` passes on all five matrix targets.

---

## Naming Summary

| Artifact | Registry | Purpose |
| --- | --- | --- |
| `@ornery/ui-grid` | npm | Angular library + web component (today) |
| `@ornery/ui-grid-react` | npm | React adapter (today) |
| `@ornery/ui-grid-engine-wasm` | npm | wasm-pack output of `ui-grid-wasm` |
| `@ornery/ui-grid-native` | npm | napi-rs prebuilds (optional) |
| `ui-grid-contracts` | crates.io | `serde` types and schema |
| `ui-grid-fixtures` | crates.io | parity fixtures (dev-only consumers) |
| `ui-grid-core` | crates.io | pure Rust engine |
| `ui-grid-wasm` | crates.io | WASM boundary and serialization shims |

---

## Rust UI Wrapper Recommendation

Once Angular, React, and web components are already consuming the Rust core,
the first Rust-native wrapper should be a thin adapter with the same mental
model:

- grid options configure behavior
- commands mutate state
- view-model results drive rendering
- host-specific rendering stays outside the engine

Recommendation: start with Dioxus.

Why Dioxus first:

- it spans web and desktop, so one wrapper can validate the portability story
- it appears to have strong growth momentum without a deeply entrenched
  datagrid incumbent
- it is a good fit for a thin wrapper that maps existing adapter concepts onto
  Rust components and hooks

Decision rule:

- validate framework choice immediately before implementation starts using
  current ecosystem signals
- if Leptos or Yew clearly overtakes Dioxus in adoption and demand for complex
  grid widgets, switch the first wrapper target then

---

## Release Workflow Changes

The current `.github/workflows/publish.yml` builds the `full` preset, the
element bundle, and runs `prepare-release-package.mjs --presets full`. To add
Rust-compatible artifacts:

1. **New job `schema`** (Phase A): runs `node scripts/emit-engine-schema.mjs`,
   uploads `dist/npm-package/schema/*.json` as a workflow artifact, and fails
   if `engineContractVersion` is unchanged but schemas differ.
2. **New job `rust-ci`** (Phase C): `cargo fmt`, `cargo clippy`, `cargo test`,
   `cargo check --target wasm32-unknown-unknown`.
3. **New job `publish-crates`** (Phases D–G): runs after the npm publish job
   succeeds, gated on a `crates-io` GitHub environment with a manual approval
   for the first publish of any new crate.
4. **New job `publish-wasm-npm`** (Phase G): runs `wasm-pack publish` after
   `publish-crates` succeeds, ensuring crate and npm versions stay in lockstep.
5. **New job `adapter-parity`** (Phase F): runs Angular, React, and web-component integration tests against the Rust core path.
6. **New job `publish-native`** (Phase H, optional): napi-rs matrix build +
   `npm publish --provenance`.

All new jobs are non-blocking until their phase exits. The existing JS publish
path remains the single source of truth for the Angular and React packages.

---

## Security and Supply-Chain Notes

- Every published Rust crate runs `cargo audit` and `cargo deny check` in CI
  before `cargo publish`.
- Every published npm package (including the wasm one) is published with
  `--provenance` so the SLSA attestation chain matches the existing JS
  packages.
- `.wasm` artifacts are reproducibly built (`wasm-pack` with a pinned
  toolchain via `rust-toolchain.toml`) so the SHA published in
  `wasmIntegrity` is verifiable from source.
- No `unsafe` Rust outside of clearly justified FFI shims in
  `ui-grid-wasm` and `ui-grid-napi`. `#![forbid(unsafe_code)]` on
  `ui-grid-core` and `ui-grid-contracts`.

---

## Out of Scope for This Plan

- Rewriting the Angular, React, or web-component rendering layers in Rust.
- Building a Rust-native UI adapter before the existing JS-facing adapters are
  already on the Rust core.
- Replacing the TypeScript engine before parity is proven via the dual-run
  feature flag described in `rust-approach-plan.md` Phase 4.

---

## Recommended Order of Execution

1. Phase A — schema-first contract.
2. Phase B — verify the existing npm build is WASM-friendly.
3. Phase C — Cargo workspace skeleton.
4. Phase D — publish `ui-grid-contracts`.
5. Phase E — implement `ui-grid-core`.
6. Phase F — switch Angular, React, and web components to the Rust core.
7. Phase G — ship `ui-grid-wasm` to both registries.
8. Phase H — only if profiling justifies a native Node addon.

Each phase is independently shippable and independently revertible.
