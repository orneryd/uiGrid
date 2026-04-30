# wasm — Wholesale WASM Cutover

## What to Build

Replace the TypeScript core (`grid.core.*.ts`) with Rust/WASM. Every function in the TS core must have a Rust equivalent exposed via WASM. A single TS bridge module (`grid.core.wasm-bridge.ts`) re-exports everything from WASM with the original TS type signatures. The cutover happens by changing one file (`grid.core.ts`) from re-exporting 16 TS modules to re-exporting the bridge.

**Do NOT delete any existing `.ts` files.** They remain as fallback.

## Execution Order

Work in this exact order. Verify each step compiles before moving on.

### Step 1: Rust Model Updates (`crates/ui-grid-core/src/models.rs`)

Add missing fields to match the TS models in `projects/ui-grid/src/lib/grid/grid.models.ts`.

**`GridColumnDef`** — add these fields (all `#[serde(default)]` unless noted):

```rust
#[serde(default)]
pub pinned_left: bool,
#[serde(default)]
pub pinned_right: bool,
#[serde(default = "default_true")]
pub enable_pinning: bool,
#[serde(default)]
pub width: Option<String>,
#[serde(default)]
pub align: Option<String>,
```

**`GridOptions`** — add:

```rust
#[serde(default)]
pub enable_column_moving: bool,
#[serde(default)]
pub enable_pinning: bool,
#[serde(default = "default_true")]
pub enable_pagination_controls: bool,
#[serde(default)]
pub tree_indent: Option<usize>,
#[serde(default = "default_true")]
pub show_tree_expand_no_children: bool,
#[serde(default)]
pub tree_row_header_always_visible: bool,
#[serde(default)]
pub infinite_scroll_rows_from_end: Option<usize>,
#[serde(default)]
pub infinite_scroll_up: bool,
#[serde(default)]
pub infinite_scroll_down: Option<bool>,
#[serde(default)]
pub viewport_height: Option<usize>,
```

Also update the `Default` impl to include all new fields.

**`GridSavedState`** — add:

```rust
#[serde(default)]
pub pinning: BTreeMap<String, String>,
```

**New struct: `GridLabels`** — add with all 25 fields from `grid.models.ts:121-180`. Use `#[serde(rename_all = "camelCase")]`. Implement `Default` with values from `projects/ui-grid/src/lib/grid/i18n/en-US.json`.

**New struct: `GridInfiniteScrollState`**:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridInfiniteScrollState {
    #[serde(default)]
    pub scroll_up: bool,
    #[serde(default)]
    pub scroll_down: bool,
    #[serde(default)]
    pub data_loading: bool,
    #[serde(default)]
    pub previous_visible_rows: usize,
}
```

**Verify:** `cargo check --workspace`

### Step 2: New Rust Modules

Create 4 new files. Port each function 1:1 from the corresponding TS file. Use the exact same logic — don't optimize or restructure.

#### `crates/ui-grid-core/src/viewmodel.rs`

Port ALL functions from `projects/ui-grid/src/lib/grid/grid.core.viewmodel.ts` (~28 functions). Reference the TS source directly. These take `&GridOptions`, `&GridColumnDef`, `&GridLabels`, `&GridRow`, etc. They return `bool`, `String`, or similar simple types.

#### `crates/ui-grid-core/src/pinning.rs`

Port ALL functions from `projects/ui-grid/src/lib/grid/grid.core.pinning.ts` (7 functions).

Key types:

- `PinDirection` — enum with `Left`, `Right`, `None` (serde rename to lowercase)
- `PinnedColumnState` — `BTreeMap<String, String>` (values are `"left"` or `"right"`)
- `compute_pinned_offset` returns `Option<PinnedOffset>` where `PinnedOffset { side: String, offset: String }`

#### `crates/ui-grid-core/src/infinite_scroll.rs`

Port ALL functions from `projects/ui-grid/src/lib/grid/grid.core.infinite-scroll.ts` (5 functions). They take/return `GridInfiniteScrollState`.

#### `crates/ui-grid-core/src/identity.rs`

Port from `projects/ui-grid/src/lib/grid/grid.core.identity.ts`:

- `find_grid_row_by_id(rows: &[GridRow], row_id: &str) -> Option<GridRow>`
- `build_grid_sort_state(column_name: String, direction: Option<SortDirection>) -> SortState`
- `resolve_grid_row_id` — handle String input and struct-with-id. Skip the `rowIdentity` callback (TS bridge handles that).

#### Update `crates/ui-grid-core/src/edit.rs`

Add one function:

```rust
pub fn is_printable_grid_key(key: &str, ctrl_key: bool, meta_key: bool, alt_key: bool) -> bool {
    key.chars().count() == 1 && !ctrl_key && !meta_key && !alt_key
}
```

#### Update `crates/ui-grid-core/src/lib.rs`

Add:

```rust
pub mod identity;
pub mod infinite_scroll;
pub mod pinning;
pub mod viewmodel;
```

**Verify:** `cargo check --workspace` and `cargo test --workspace`

### Step 3: Expand WASM Boundary (`crates/ui-grid-wasm/src/lib.rs`)

Add `#[wasm_bindgen]` exports for EVERY public function across all modules. Follow the existing pattern exactly:

```rust
#[wasm_bindgen]
pub fn some_function_js(arg: JsValue) -> Result<JsValue, JsValue> {
    let arg: SomeType = from_js(arg)?;
    let result = some_function(&arg);
    to_js(&result)
}
```

For functions returning simple types (`bool`, `String`, `usize`), return them directly without `to_js`:

```rust
#[wasm_bindgen]
pub fn is_pinning_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_pinning_enabled(&options))
}
```

Add ALL imports at the top. Group exports by module with comments.

Export ALL functions from these modules:

- **viewmodel** — 28 functions
- **pinning** — 7 functions
- **edit** — 9 functions (8 existing + `is_printable_grid_key`)
- **row_state** — 9 functions
- **pagination** — 9 functions
- **state** — `sanitize_download_filename_js`, `normalize_boolean_map_js`, `is_safe_state_key_js`
- **identity** — 3 functions
- **infinite_scroll** — 5 functions
- **display** — `format_grid_cell_display_value_js`
- **export** — `header_label_js`
- **filtering** — `matches_grid_row_filters_js`, `clear_grid_filter_reasons_js`
- **sorting** — `sort_grid_rows_js`
- **tree** — `build_grid_rows_js`, `is_tree_enabled_js`, `filter_and_flatten_grid_tree_rows_js`
- **utils** — `get_path_value_js`, `get_cell_value_js`, `stringify_cell_value_js`, `titleize_js`
- **grouping** — `build_grid_display_items_js`

**Verify:** `npm run build:rust:wasm` succeeds and `dist/ui-grid-wasm/ui_grid_wasm.d.ts` lists all exports.

### Step 4: TS Bridge Layer

#### Create `projects/ui-grid/src/lib/grid/grid.core.wasm-bridge.ts`

This file:

1. Dynamically imports the WASM module from `'../../../../../dist/ui-grid-wasm/ui_grid_wasm.js'`
2. Re-exports every function with the original TS type signatures from `grid.core.types.ts`, `grid.models.ts`, etc.
3. Each function calls the corresponding `_js` WASM export
4. Uses `@vite-ignore` for the dynamic import (same as `ui-grid.engine.wasm.ts`)

**Critical: Callback-bearing functions need TS fallbacks.**

These functions accept JS callbacks that can't cross the WASM boundary:

- `exportCsvRows` — has optional `formatCell` callback (3rd arg). When provided, fall back to the TS implementation from `grid.core.export.ts`. When absent, delegate to WASM.
- `findNextGridCell` — has optional `isCellAllowed` callback. When provided, fall back to TS from `grid.core.edit.ts`. When absent, delegate to WASM.
- `resolveGridRowId` — uses `options.rowIdentity`. Always handle in TS (from `grid.core.identity.ts`) since the TS version is trivial and always needs the callback.
- `buildGridPipeline` — the `now` callback and `column.sortingAlgorithm`/`column.valueGetter`/`column.formatter` callbacks. The Rust pipeline has its own sort/filter/display logic that doesn't need these. The `now` callback is only for timing — Rust uses its own. So this one delegates to WASM with no fallback needed.

The bridge must also re-export all types/interfaces from `grid.core.types.ts` (they're pure types, no WASM needed).

**Pattern for each exported function:**

```ts
import type { GridOptions } from './grid.models';

// Lazy WASM module reference
let wasmModule: typeof import('../../../../../dist/ui-grid-wasm/ui_grid_wasm.js') | null = null;
const wasmReady = import(/* @vite-ignore */ '../../../../../dist/ui-grid-wasm/ui_grid_wasm.js')
  .then((m) => {
    wasmModule = m;
  })
  .catch(() => {
    /* fallback to TS */
  });

// For sync functions, the WASM module must be loaded before use.
// The engine init (Step 5) ensures this.

export function isPinningEnabled(options: GridOptions): boolean {
  if (wasmModule) return wasmModule.is_pinning_enabled_js(options);
  // fallback
  return tsCore.isPinningEnabled(options);
}
```

Actually, since the WASM module needs to be loaded synchronously for the grid to work, use a **sync init pattern**:

```ts
import * as tsCore from './grid.core.pipeline'; // fallback
// ... etc for other TS modules

let wasm: any = null;

export async function initWasmCore(): Promise<boolean> {
  try {
    wasm = await import(/* @vite-ignore */ '../../../../../dist/ui-grid-wasm/ui_grid_wasm.js');
    return true;
  } catch {
    return false;
  }
}

export function isWasmReady(): boolean {
  return wasm !== null;
}
```

Then each function checks `wasm` and falls back to the TS import.

**Re-export all types** from `grid.core.types.ts` directly (they're just interfaces):

```ts
export type {
  GroupItem,
  RowItem,
  ExpandableItem,
  DisplayItem,
  PipelineResult,
  BuildGridPipelineContext,
  GridInfiniteScrollState,
  GridMoveDirection,
} from './grid.core.types';
```

#### Modify `projects/ui-grid/src/lib/grid/grid.core.ts`

Replace the entire contents with:

```ts
export * from './grid.core.wasm-bridge';
```

Keep the old content commented out or in a `grid.core.ts-only.ts` backup for easy rollback.

#### Update `projects/ui-grid/src/lib/grid/ui-grid.engine.ts`

Update to auto-initialize the WASM core. Import `initWasmCore` from the bridge and call it eagerly. The `RustBackedGridEngine` should await WASM init before first use if possible, or the component init effect should call `initWasmCore()`.

### Step 5: GridRow Compatibility

In `projects/ui-grid/src/lib/grid/grid.core.identity.ts`, replace:

```ts
if (row instanceof GridRow) {
```

with:

```ts
if (typeof row === 'object' && row !== null && 'id' in row && 'entity' in row) {
```

This handles both class instances and plain objects from WASM.

## Key Reference Files

- TS models: `projects/ui-grid/src/lib/grid/grid.models.ts`
- TS core barrel: `projects/ui-grid/src/lib/grid/grid.core.ts`
- TS pipeline: `projects/ui-grid/src/lib/grid/grid.core.pipeline.ts`
- TS viewmodel: `projects/ui-grid/src/lib/grid/grid.core.viewmodel.ts`
- TS pinning: `projects/ui-grid/src/lib/grid/grid.core.pinning.ts`
- TS infinite scroll: `projects/ui-grid/src/lib/grid/grid.core.infinite-scroll.ts`
- TS identity: `projects/ui-grid/src/lib/grid/grid.core.identity.ts`
- TS edit: `projects/ui-grid/src/lib/grid/grid.core.edit.ts`
- TS state: `projects/ui-grid/src/lib/grid/grid.core.state.ts`
- TS export: `projects/ui-grid/src/lib/grid/grid.core.export.ts`
- TS engine: `projects/ui-grid/src/lib/grid/ui-grid.engine.ts`
- TS engine WASM: `projects/ui-grid/src/lib/grid/ui-grid.engine.wasm.ts`
- TS labels JSON: `projects/ui-grid/src/lib/grid/i18n/en-US.json`
- Existing WASM lib: `crates/ui-grid-wasm/src/lib.rs`
- Existing Rust core: `crates/ui-grid-core/src/`
- Rust models: `crates/ui-grid-core/src/models.rs`
- WASM build output: `dist/ui-grid-wasm/`

## Conventions

- Rust: `snake_case` everywhere, `#[serde(rename_all = "camelCase")]` on all structs/enums
- WASM exports: suffix `_js` (e.g., `is_pinning_enabled_js`)
- All new Rust files need `use` imports — don't use `crate::*` glob imports
- Run `cargo fmt` after changes
- Run `cargo clippy --workspace` and fix all warnings
- All WASM functions return `Result<T, JsValue>` for complex types or `T` directly for primitives

## Verification Commands

```bash
# Rust
cargo check --workspace
cargo test --workspace
cargo clippy --workspace

# WASM build
npm run build:rust:wasm

# Check WASM exports
cat dist/ui-grid-wasm/ui_grid_wasm.d.ts

# TS tests (after bridge is wired up)
npm run build:library
npm test
```
