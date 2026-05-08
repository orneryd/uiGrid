# Rust Crates — Agent Instructions

Rust workspace providing a native grid engine, egui adapter, WASM bridge, C ABI, and C++/LVGL targets.

## Build & Test

```bash
cargo test --workspace                                    # All Rust tests
cargo clippy --workspace --all-targets -- -D warnings     # Lint
wasm-pack build crates/ui-grid-wasm --target bundler      # WASM for JS bundlers
wasm-pack build crates/ui-grid-wasm --target web          # WASM for browser ESM
```

## Crate Layout

| Crate | Purpose |
|-------|---------|
| `ui-grid-contracts` | Shared types/traits: `GridOptions`, `GridColumnDef`, `GridRecord`, `GridEngine` trait |
| `ui-grid-core` | Pure Rust grid engine: pipeline, sort, filter, group, paginate |
| `ui-grid-virtualization` | Virtual scroll math (start index, visible count, offset) |
| `ui-grid-fixtures` | Test data generators |
| `ui-grid-egui` | egui widget: `UiGridWidget` renders the grid natively |
| `ui-grid-wasm` | `wasm-bindgen` bridge: exposes the Rust engine to JS via `WasmGridEngine` |
| `ui-grid-c-abi` | C-compatible FFI: `ui_grid_*` functions for embedding in C/C++ hosts |
| `ui-grid-cpp` | C++ header-only wrapper around the C ABI |
| `ui-grid-lvgl` | LVGL integration for embedded displays |

## Architecture Rules

- `ui-grid-contracts` is the dependency root — all other crates depend on it
- `ui-grid-core` (Rust) mirrors the TypeScript core's pipeline logic
- The WASM bridge (`ui-grid-wasm`) serializes between JS objects and Rust structs via `serde` + `wasm-bindgen`
- The C ABI uses opaque pointers and explicit `free` functions — no exceptions, no panics across FFI
- egui crate is `no_std`-compatible (with `alloc`)

## WASM Bridge

The JS side imports:
```ts
import init, { WasmGridEngine } from '@ornery/ui-grid-wasm';
await init();
const engine = new WasmGridEngine();
const result = engine.buildPipeline(optionsJson);
```

The bridge accepts/returns JSON strings for complex types. Simple scalars pass directly.

## Do NOT

- Panic across FFI boundaries — use `catch_unwind` at C ABI entry points
- Add `std` deps to the egui crate without a feature gate
- Break the `ui-grid-contracts` API without updating all downstream crates
- Forget to run `wasm-opt` (wasm-pack does this automatically in release mode)
- Commit generated `pkg/` or `target/` directories
