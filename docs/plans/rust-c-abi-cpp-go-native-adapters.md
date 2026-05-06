# Rust C ABI, C++, Go, and Native Adapter Plan

**Goal**

Expose `ui-grid-core` through a stable C ABI, layer a C++ binding over that ABI, add a Go wrapper on top of the same C layer, and then build native UI adapters for the most relevant C/C++ and Go UI stacks without duplicating grid core logic.

The shared Rust core remains the single source of truth for:

- filtering, sorting, grouping, pagination, and virtualization math
- pinning, tree, expandable, and save-state behavior
- pipeline output and view-model projection
- command handling and state transitions

The C ABI, C++, Go, and native UI adapters become transport and rendering layers only.

## Non-Negotiable Architecture Rules

1. No core logic duplication outside Rust.
2. C is the lowest-level foreign-function boundary.
3. C++ and Go bind to the C layer, not directly to Rust internals.
4. Native UI adapters consume a host-neutral projected view model from Rust.
5. ABI versioning is explicit and checked at runtime.

## Why This Layering

The C ABI gives the widest import surface:

- C callers can bind directly.
- C++ wrappers can provide RAII, type safety, and framework adapters.
- Go can consume the same exports through `cgo`.
- Future languages can target the same stable ABI without rethinking the Rust boundary.

That means one canonical engine in Rust and multiple host-language adapters above it.

## Proposed Crate Layout

Add these crates to the workspace in phases:

1. `crates/ui-grid-c-abi`
2. `crates/ui-grid-cpp`
3. `crates/ui-grid-go`
4. `crates/ui-grid-qt`
5. `crates/ui-grid-imgui`
6. `crates/ui-grid-wxwidgets`
7. `crates/ui-grid-fyne`

Notes:

- `ui-grid-c-abi` is the real boundary.
- `ui-grid-cpp` is a binding layer, not a second engine.
- `ui-grid-go` is a Go package plus any thin C helpers needed for `cgo` ergonomics.
- Native UI adapter crates should stay thin and consume projected state and command APIs from Rust.

## Target Frameworks

Primary C/C++ targets:

1. **Qt**: dominant general-purpose C++ desktop/UI framework.
2. **Dear ImGui**: high-value immediate-mode C++ target and closest conceptual bridge from `egui`.
3. **wxWidgets**: broad native desktop install base and conventional retained-mode toolkit.

Primary Go target:

1. **Fyne**: pragmatic primary Go UI target for a native Go adapter without introducing a browser shell.

Secondary / later candidates:

1. FLTK
2. JUCE
3. Gio
4. Wails

The first wave should stay focused. Qt, Dear ImGui, and Fyne are enough to validate the architecture.

## Milestone 1: Freeze the Foreign Boundary

Before exporting C symbols, define what the foreign layers are allowed to see.

### Deliverables

1. Freeze a host-neutral engine contract around:
   - grid options
   - column definitions
   - row payloads
   - commands
   - projected render state
   - save/restore state
2. Expand `ui-grid-contracts` to carry:
   - ABI version
   - projection/schema version
   - command/event version
3. Define the ownership model for foreign memory.

### Required design choices

1. Prefer opaque handles for engine instances.
2. Prefer explicit alloc/free exports for Rust-owned strings and buffers.
3. Prefer polling or snapshot retrieval over callback-heavy ABI designs initially.
4. Prefer plain C structs and UTF-8 JSON/bytes over passing Rust layout types across the boundary.

### Exit criteria

1. The ABI contract is documented.
2. Version checks are specified.
3. The core team can answer “what is stable vs internal” unambiguously.

## Milestone 2: Build `ui-grid-c-abi`

Create a `cdylib` / `staticlib` wrapper over `ui-grid-core`.

### Library shape

Export a minimal engine lifecycle:

1. `ui_grid_abi_version()`
2. `ui_grid_engine_create()`
3. `ui_grid_engine_destroy()`
4. `ui_grid_engine_set_options_json()`
5. `ui_grid_engine_set_rows_json()`
6. `ui_grid_engine_apply_command_json()`
7. `ui_grid_engine_get_projection_json()`
8. `ui_grid_engine_save_state_json()`
9. `ui_grid_engine_restore_state_json()`
10. `ui_grid_last_error_message()`
11. `ui_grid_string_free()`

### Projection strategy

Do not make foreign adapters rebuild grid behavior themselves.

Rust should project a host-neutral render model containing at least:

1. visible columns
2. visible rows / display items
3. grouped rows
4. pinned regions
5. cell display values
6. editability / focus / expansion state
7. viewport and virtualization metadata
8. labels / i18n strings

This projected view model is what Qt, ImGui, wxWidgets, and Fyne should render.

### Why JSON first

JSON is not the final optimized transport, but it is the right first ABI transport because:

1. it is easy to inspect and debug
2. it keeps the first cross-language adapters simple
3. it reduces FFI surface complexity while stabilizing the contract

Later optimization can add:

1. packed binary snapshots
2. columnar row buffers
3. incremental diff payloads

### Exit criteria

1. C examples compile and run.
2. ABI version checks work.
3. A foreign host can configure the grid, request a projection, and round-trip saved state.

## Milestone 3: Build the C++ Binding Layer

Add a C++ wrapper over `ui-grid-c-abi`.

### Deliverables

1. RAII engine wrapper class.
2. Typed C++ DTOs or thin JSON helpers.
3. Command helpers for sorting, filtering, paging, grouping, pinning, and editing.
4. Projection accessors for common host-side rendering flows.

### Design direction

1. The wrapper owns the native handle and destroys it automatically.
2. Exceptions stay out of the C ABI; map them at the C++ layer if desired.
3. Keep the wrapper close to the Rust model names to preserve conceptual parity.

### Exit criteria

1. C++ host code can configure the engine without touching raw C strings directly.
2. The wrapper is thin enough that behavior still clearly lives in Rust.

## Milestone 4: Build the Go Binding Layer

Add a Go package that consumes the C ABI through `cgo`.

### Deliverables

1. Go engine wrapper with lifecycle management.
2. Go-friendly `Options`, `ColumnDef`, `State`, and `Projection` structs.
3. Helpers for row updates, commands, and state round-trips.

### Design direction

1. Keep the Go wrapper thin and explicit.
2. Avoid hidden background threads or implicit callbacks in the first version.
3. Keep ownership rules obvious across `cgo`.

### Exit criteria

1. Go can load the Rust-backed engine and render from projected state.
2. The Go package does not duplicate pipeline or state logic.

## Milestone 5: Translate the egui Adapter Pattern into New Hosts

The `ui-grid-egui` crate is the reference native adapter. The goal is not to copy egui widget code line-for-line, but to translate its host responsibilities into equivalent adapters on top of the same Rust core.

### Shared adapter principle

Each native adapter owns only:

1. host widget creation
2. input event capture
3. scroll container plumbing
4. drawing/render tree mapping
5. edit widget presentation
6. focus and selection presentation

Each native adapter does **not** own:

1. sorting logic
2. filtering logic
3. grouping logic
4. pinning math
5. save-state logic
6. virtualization math

Those remain in Rust core and/or the projected view-model layer.

## Adapter-Specific Notes

### Qt

Best fit for a retained-mode model/view adapter.

Recommended direction:

1. Start with a `QAbstractScrollArea` or model/view-based integration.
2. Feed Rust-projected rows/columns into the Qt presentation layer.
3. Route sort/filter/edit commands back through the C++ wrapper.

### Dear ImGui

Best fit for the first C++ adapter after the generic binding, because the immediate-mode structure is conceptually closest to `egui`.

Recommended direction:

1. Translate the `egui` adapter responsibilities directly into ImGui draw/layout calls.
2. Reuse the same projected state and command flow.
3. Validate pinned-region and virtualization behavior here early.

### wxWidgets

Best fit as a retained desktop adapter once the C++ wrapper is stable.

Recommended direction:

1. Start from a scrollable composite widget.
2. Keep data projection in Rust and only paint/layout in wxWidgets.

### Fyne

Best fit for the first Go-native adapter.

Recommended direction:

1. Build a Go widget backed by the Rust projection.
2. Translate scroll, selection, edit, and resize events into ABI commands.
3. Keep the actual grid rules in Rust.

## Performance Strategy

The FFI plan should not regress the existing Rust engine’s performance.

### First release performance posture

1. Optimize for correctness and stable boundaries first.
2. Use JSON transport initially.
3. Benchmark projection size, command throughput, and redraw cadence.

### Second-wave optimization targets

1. incremental projection diffs
2. binary projection transport
3. string-table reuse
4. host-side row recycling hooks
5. pinned-region projection slices

### Rule

Do not push rendering logic down into each foreign adapter just to avoid transport cost. Optimize the Rust-to-host transport first.

## Test Strategy

### Core conformance

Keep the existing Rust core tests authoritative for behavior.

### ABI tests

Add tests for:

1. handle lifecycle
2. invalid JSON / invalid command handling
3. version mismatch behavior
4. save/restore round-trips
5. projection schema stability

### Adapter conformance

Each adapter should run the same high-level scenarios:

1. sorting
2. filtering
3. grouping
4. pinning
5. pagination
6. tree
7. expandable rows
8. editing
9. save/restore

## Recommended First Execution Slice

Do this first, in order:

1. Expand `ui-grid-contracts` to define ABI and projection versions.
2. Create `ui-grid-c-abi` as `cdylib` + `staticlib`.
3. Export lifecycle + JSON options/rows/commands + projection/state getters.
4. Add one C smoke example.
5. Add one C++ wrapper around that ABI.
6. Add one Dear ImGui proof-of-concept adapter or one Qt proof-of-concept adapter.
7. Add the Go wrapper after the C ABI is stable.

That sequencing keeps the lowest-level contract stable before multiplying adapters.

## Deliverable Sequence

1. `ui-grid-c-abi` preview
2. C example app
3. `ui-grid-cpp` wrapper preview
4. First native C++ adapter preview
5. `ui-grid-go` wrapper preview
6. Fyne preview adapter

## Documentation Follow-Up

Once implementation begins, update:

1. `docs/rust.md`
2. `docs/rust-egui.md`
3. crate READMEs for each new FFI/adapter crate
4. a feature parity matrix across egui, C ABI, C++, and Go adapters

## Success Criteria

This effort succeeds if:

1. Rust remains the only location for shared grid behavior.
2. C, C++, and Go can all drive the same engine contract.
3. Native adapters differ only in rendering/event plumbing.
4. Feature additions continue to land in Rust core first and flow outward through bindings.