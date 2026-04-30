# ui-grid Recommended Rust Approach

## Recommendation

Do not begin by rewriting the Angular component or by building a Rust-native UI adapter first.

The target architecture should be:

- one Rust implementation of the grid core
- thin Angular, React, and web-component adapters that call that Rust core
- a future Rust-native UI wrapper that preserves the same mental-model API

The recommended path is:

1. split out a framework-agnostic grid core in TypeScript
2. freeze its contracts with cross-language fixtures
3. implement the stable core in Rust
4. expose it through a thin WASM wrapper for Angular, React, and web-component consumers
5. dual-run TypeScript and Rust only long enough to prove parity
6. retire the TypeScript engine so JavaScript owns adapters, not duplicate core logic
7. add a Rust-native adapter only after the engine boundary is proven

This keeps the current Angular product moving while creating a credible path to a portable Rust-backed engine without committing to permanent dual maintenance.

## Why Rust Fits ui-grid

Rust is a good match for the parts of ui-grid that are deterministic, state-heavy, and performance-sensitive:

- large-row pipeline computation
- grouping and flattening logic
- sorting and filter evaluation
- state validation and normalization
- SSR window calculation
- save-state and export transformations

Rust is a poor first target for the parts that are highly framework- and platform-specific:

- DOM rendering
- templates and cell composition
- browser event plumbing
- drag and drop integration
- focus management against live elements
- `ResizeObserver`, scroll, and file download APIs

That means the right architectural role for Rust is the engine, with TypeScript retained only for framework adapters and browser integration.

## What Rust Should Own

The first Rust engine scope should include:

- normalized grid option snapshots
- normalized column descriptors
- row identity and row metadata
- filter parsing and evaluation rules
- sort descriptors and comparator dispatch rules
- grouping state and flattened display structure
- pagination math
- tree and expandable-row logical state
- save-state validation and normalization
- CSV serialization rules
- SSR visible-window calculation
- benchmarkable pipeline execution

## What Rust Should Not Own Initially

- Angular signals or effects
- any HTML or DOM output
- CDK virtualization
- drag/drop primitives
- editable cell templates
- real browser focus behavior
- actual file download triggering
- framework event emitter surfaces such as `UiGridApi`

## Target End State

The intended end state is not "a Rust version and a JavaScript version".

The intended end state is:

- Rust owns the full core grid engine
- Angular, React, and web components adapt their existing APIs onto the Rust engine
- JavaScript remains only where the browser or framework requires it

That means the TypeScript core should be treated as a migration scaffold, parity oracle, and rollback path during the transition, not as a permanently co-equal implementation.

## Recommended Boundary Shape

Use a pure data boundary first.

That means the Rust core should receive plain snapshots and commands, and return plain results, rather than maintaining a long-lived opaque WASM object as the first design.

Recommended model:

- input: normalized options, prior state, and a command or evaluation request
- output: next state, pipeline output, warnings, and feature-specific result payloads

Why this is the right first step:

- easier to test against the existing TypeScript implementation
- easier to dual-run in development and compare results
- easier to reuse from SSR, browser, and future Rust-native adapters
- lower coupling to JavaScript object lifetimes and WASM handle management

If later profiling proves that a stateful engine handle is materially faster, that optimization can be introduced after the contract is stable.

## Recommended Repository Layout

Do not mix the first Rust experiment into the Angular library internals directly.

Use a root-level Cargo workspace once the seam split exists.

Recommended structure:

```text
crates/
  ui-grid-core/
  ui-grid-wasm/
docs/
  seam-split-refactor-plan.md
  rust-approach-plan.md
projects/
  ui-grid/
src/
```

### `ui-grid-core`

Owns pure Rust domain logic with no WASM-specific code.

### `ui-grid-wasm`

Owns the JS/WASM boundary, serialization glue, and any adapter-facing convenience methods.

This separation matters because it keeps the main engine reusable for future Rust-native adapters and test harnesses.

## Interface Strategy

The current `grid.models.ts` and extracted core contracts should become the source material for a shared engine contract.

Recommended contract families:

- `GridOptionsSnapshot`
- `GridColumnSnapshot`
- `GridStateSnapshot`
- `GridCommand`
- `GridPipelineRequest`
- `GridPipelineResult`
- `GridSaveStateResult`
- `GridCsvExportResult`

The main discipline is to keep these transport-friendly and framework-neutral.

Avoid passing callbacks, template references, or live framework objects across the boundary.

## Delivery Phases

## Phase 0: Finish the Seam Split First

Prerequisite:

- the core pipeline and feature state transitions must already be extractable in plain TypeScript without Angular imports

Exit criteria:

- the TypeScript core has stable inputs and outputs that can be mirrored in Rust

## Phase 1: Freeze Cross-Language Fixtures

Deliverables:

- canonical JSON fixtures for grid options, rows, commands, and expected results
- coverage for sorting, filtering, grouping, pagination, expansion, tree view, save-state, CSV export, and SSR visible-window behavior

Exit criteria:

- the TypeScript engine can produce deterministic outputs for the fixture corpus

## Phase 2: Implement `ui-grid-core` in Rust

Deliverables:

- pure Rust types and transformation logic
- core pipeline implementation
- parity tests against the fixture corpus

Exit criteria:

- the Rust engine matches the TypeScript engine behavior for the agreed fixture set

## Phase 3: Implement `ui-grid-wasm`

Deliverables:

- WASM export layer
- serialization helpers
- JS-friendly entry points

Exit criteria:

- a browser or Node test can call the Rust engine and receive the same outputs as the TypeScript engine

## Phase 4: Dual-Run in Angular Under a Feature Flag

Deliverables:

- dev-only mode that runs both engines for selected scenarios
- mismatch logging for state or pipeline diffs

Exit criteria:

- parity is proven against real adapter usage before switching production paths

## Phase 5: Switch Angular, React, and Web Components to Rust

Deliverables:

- route all pure engine work through Rust
- keep Angular rendering, host integration, and `UiGridApi` orchestration in TypeScript
- keep React and web-component packages on the same Rust engine contract

Exit criteria:

- production Angular, React, and web-component adapters can run on the Rust engine without public API changes

## Phase 6: Retire the TypeScript Engine

Deliverables:

- freeze the legacy TypeScript engine behind a fallback flag only
- stop landing new engine behavior in TypeScript
- remove the fallback once parity and performance hold across supported adapters

Exit criteria:

- Rust is the only maintained implementation of pipeline and state-transition logic
- TypeScript remains only as adapter, packaging, and browser-integration code

## Phase 7: Add the First Rust-Native Adapter

Recommendation:

- target Dioxus first, while re-checking ecosystem traction before implementation starts

Reasoning:

- Dioxus is growing quickly across web and desktop, which matters if the same thin wrapper should serve multiple Rust surfaces
- the market gap for a serious grid appears stronger in Dioxus than in Leptos, where `leptos-struct-table` already covers more of the table space
- Yew remains a credible follow-on target, especially because existing AG Grid bindings there suggest proven demand for richer grids
- the wrapper should preserve the same mental model: grid options in, commands in, state and view-model results out

Exit criteria:

- the first Rust-native adapter proves the engine boundary is genuinely thin

## Why Dioxus First

From the ecosystem research:

- Dioxus has strong visibility and cross-platform positioning
- public discussion signals show demand for performant table behavior
- there is not an obvious equivalent to a mature datagrid with the feature depth ui-grid is aiming for

Leptos is still important, but it appears less underserved at the table layer than Dioxus.

## Role of Loco

Loco is a good companion framework for demos, documentation, and full-stack reference apps.

It is not the right place to anchor the ui-grid architecture itself.

Recommended use of Loco:

- reference backend for large datasets
- auth and server-query demo app
- server-side export examples
- SSR integration showcase

Loco should be treated as an ecosystem showcase around the grid, not as the grid engine.

## Packaging Recommendation

Target both ecosystems eventually:

- npm package for JS and Angular adapters consuming the WASM build
- crates.io package for Rust-native consumers

Suggested package strategy:

- keep the existing Angular package stable
- add a dedicated WASM-backed package only when the Rust engine is production-ready
- avoid forcing all consumers onto WASM until parity and bundle costs are validated

## Main Risks

### Risk: Rewriting too early

If Rust work begins before the seam split is real, the project will duplicate Angular-specific assumptions in another language.

Mitigation:

- do not start Rust implementation before the TypeScript core exists as a clean boundary

### Risk: Bad WASM boundary design

If the boundary passes framework objects or overly granular calls, performance and maintainability will both suffer.

Mitigation:

- use coarse, snapshot-oriented requests and results first

### Risk: Chasing the wrong first adapter

If the first Rust-native target is chosen only on popularity, the product may land in a market that already has enough table coverage.

Mitigation:

- target the combination of framework visibility and grid ecosystem gap, not popularity alone

## Success Criteria

This Rust approach is successful when:

- the grid core has one behavior contract across TypeScript and Rust
- Angular can consume the Rust engine without changing the public usage model
- the engine stays free of DOM and framework concerns
- a Dioxus or Yew adapter can reuse the same engine with only thin view bindings
- Loco can showcase the system without becoming a hard dependency

## Recommended Immediate Next Step

Do not start a Rust crate yet.

The immediate next step should be to extract the TypeScript core contracts and pipeline engine, then define the first cross-language fixture set. That is the shortest path to a Rust engine that does not become a second rewrite.
