# Rust / egui

`ui-grid-egui` is the native Rust adapter for UI Grid on top of [`egui`](https://github.com/emilk/egui). It wraps the shared grid engine (`ui-grid-core`) with an egui widget layer so Rust applications can render the grid natively without a browser or JavaScript runtime.

![ui-grid-egui demo showing pinned columns with a fixed header and filter row](../public/docs/screenshots/pinning-100k.png)

## Install

```toml
[dependencies]
ui-grid-egui = "0.1"
ui-grid-core = "0.1"
egui = "0.34"
egui_extras = { version = "0.34", features = ["datepicker"] }
```

## Minimal usage

```rust
use ui_grid_egui::{EguiColumnExt, EguiGrid, GridThemePreset};
use ui_grid_core::models::{GridColumnDef, GridColumnType, GridOptions};

let mut grid = EguiGrid::new();
let theme = GridThemePreset::DefaultDark.build();
let mut options = GridOptions {
    id: "accounts".into(),
    title: Some("Accounts".into()),
    enable_sorting: true,
    enable_filtering: true,
    enable_virtualization: true,
    ..GridOptions::default()
};

let columns = vec![
    GridColumnDef {
        name: "account_id".into(),
        display_name: Some("Account".into()),
        r#type: GridColumnType::String,
        ..GridColumnDef::default()
    },
    GridColumnDef {
        name: "revenue".into(),
        display_name: Some("Revenue".into()),
        r#type: GridColumnType::Number,
        align: Some("end".into()),
        ..GridColumnDef::default()
    },
];

let mut column_ext: Vec<EguiColumnExt> = vec![];

// Inside your egui frame:
grid.show(ui, &mut options, &columns, &mut column_ext, &theme);
```

## Feature surface

The egui adapter mirrors the vanilla web component feature-for-feature:

- **Sorting / filtering / grouping / pagination** — declarative via `GridOptions`.
- **Pinning** — left or right; pinned regions scroll vertically in sync. Column widths survive pin / unpin.
- **Drag-and-drop column reordering** — `enable_column_moving`.
- **Drag-resize columns** + **double-click resize handle to auto-fit** — measures header label + visible cell content + chrome reserve.
- **Virtualization** — 100K+ rows scroll smoothly.
- **Tree view + expandable rows** — chevron lands on the first data column even with row selection on.
- **Cell editing** — text / number / date (`egui_extras::DatePickerButton`) / boolean editors driven by column type, plus per-column overrides.
- **Row selection** — checkbox column, select-all, Ctrl/Cmd-click additive, Shift-click range, drag-paint multi-row, `Ctrl+A`, `Space`.
- **Validation chrome** — red border + tooltip on invalid cells, driven by the core `runGridCellValidators` registry.
- **Row-edit lifecycle** — `mark_row_dirty` / `mark_row_saving` / `mark_row_clean` / `mark_row_error` paint theme tints.
- **Save / restore state** — sort / filters / pin / column order / column widths round-trip through `GridSavedState`.
- **CSV export + generic exporter registry** — register your own PDF / xlsx / custom format via `register_grid_exporter`.
- **Benchmark probe** — `run_benchmark(iterations)` reports pipeline wall-time averages.
- **Theme presets** — Default Dark / Light, Wireframe Dark / Light; full `GridTheme` overrides.
- **Custom renderers** — per-cell, per-header, per-filter, per-group-row, per-expandable-row, per-empty-state, per-selection-checkbox.
- **Keyboard navigation** — Arrow keys, Tab, Enter, F2, Home, End, Ctrl+Home, Ctrl+End, first-character begins edit.
- **Infinite scroll** — `NeedLoadMoreData` event fires near the bottom; host appends rows and calls `mark_dirty`.
- **`KeyOverrideSpec`** — opt out of any built-in keydown.

## Sorting, filtering, grouping

```rust
use ui_grid_core::models::GridGroupingOptions;

let mut options = GridOptions {
    enable_sorting: true,
    enable_filtering: true,
    enable_grouping: true,
    enable_tree_view: true,
    enable_expandable: true,
    enable_virtualization: true,
    grouping: Some(GridGroupingOptions {
        group_by: vec!["status".into()],
        ..GridGroupingOptions::default()
    }),
    tree_children_field: Some("children".into()),
    ..GridOptions::default()
};
```

## Column pinning

```rust
use ui_grid_core::pinning::PinDirection;

let mut options = GridOptions {
    enable_pinning: true,
    ..GridOptions::default()
};

let columns = vec![
    GridColumnDef { name: "account_id".into(), pinned_left: true, ..GridColumnDef::default() },
    GridColumnDef { name: "status".into(), ..GridColumnDef::default() },
];

// Pin programmatically:
grid.pin_column("status", PinDirection::Right);
```

Column widths survive pin / unpin: the grid pre-fits any column without a declared width on first paint and stores the result in a shared `column_widths` map that the unpinned and pinned table layouts both consult.

## Column auto-fit and resize

The user can drag the resize gripper on any column header, or double-click it to auto-fit:

```rust
// Programmatic auto-fit — same path the dblclick handler uses.
// Measures the header label + visible cell content + 28px per
// visible header control (sort / group / pin) + the supplied
// padding budget.
grid.auto_fit_column(ui.ctx(), &columns, "owner", 24.0);

// Read / write column-width overrides. The map keys are column
// names; values are CSS-style `"<n>px"` strings.
for (name, width) in grid.column_width_overrides() {
    println!("{name} = {width}");
}
grid.set_column_width_override("owner", Some("220px".into()));
```

User drag-resize is captured back into the override map automatically on pointer release, so save / restore round-trips preserve the user's resize state and the outer scroll-area width tracks the table.

## Save & restore state

```rust
// Serialize to JSON
let json = grid.serialize_state()?;

// Restore from JSON
grid.deserialize_state(&json)?;

// Or use the structured API
let saved = grid.save_state();
grid.restore_state(&saved);
```

`GridSavedState` round-trips: sort, filters, pin direction, column order, column widths, grouping, expanded rows, expanded tree rows, current page. Empty `Vec` / `BTreeMap` / `Option` fields are skipped during serialization so empty-input round-trips produce `{}` (matches the TS shape exactly — wasm-parity tests lock this in).

## CSV export + generic exporter registry

Default CSV is wired in, no setup required:

```rust
let payload = grid.export_csv(&options, &columns);
println!("{}", payload.content);

// Or use the registry path (auto-registers CSV on first use):
use ui_grid_egui::{export_grid_via_registry, GridExportScope};

let result = grid.export(&options, &columns, "csv", GridExportScope::Visible)?;
std::fs::write(&result.filename, &result.content)?;
```

Register your own exporter for any format:

```rust
use std::sync::Arc;
use ui_grid_egui::{
    register_grid_exporter, GridExportResult, GridRegisteredExportContext,
};

register_grid_exporter(
    "pdf",
    Arc::new(|ctx: &GridRegisteredExportContext<'_>| {
        let mut body = String::from("[my pdf]\n");
        body.push_str(&format!("scope: {:?}\n", ctx.scope));
        for row in &ctx.formatted_cells {
            body.push_str(&row.join(" | "));
            body.push('\n');
        }
        GridExportResult {
            filename: format!("{}.pdf", ctx.options.id),
            content: body.into_bytes(),
            mime_type: "application/pdf".to_string(),
        }
    }),
);

let result = grid.export(&options, &columns, "pdf", GridExportScope::All)?;
```

`GridExportScope::Visible` reads from the post-filter / post-sort / post-paginate result; `All` reads from `options.data`; `Selected` reads selected ids and resolves them through `pipeline.visible_rows`.

## Custom renderers — per-column

`EguiColumnExt` is the per-column customization hook:

```rust
use ui_grid_egui::{EguiColumnExt, EguiHeaderAction};

let ext = vec![
    // 1. Plain string formatter (applied before the default label paints)
    EguiColumnExt::new("revenue")
        .with_formatter(|value, _row| {
            let amount = value.as_f64().unwrap_or(0.0);
            format!("${:.2}", amount)
        }),

    // 2. Full custom cell renderer — you paint everything
    EguiColumnExt::new("status").with_cell_renderer(|ui, ctx| {
        let status = ctx.value.as_str().unwrap_or("Unknown");
        let bg = match status {
            "Active" => egui::Color32::from_rgb(0x10, 0xB9, 0x81),
            "Trial"  => egui::Color32::from_rgb(0x38, 0xBD, 0xF8),
            "Churned" => egui::Color32::from_rgb(0xEF, 0x44, 0x44),
            _ => ctx.theme.muted_color,
        };
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width().min(90.0), 20.0),
            egui::Sense::hover(),
        );
        ui.painter().rect_filled(rect, 10.0, bg);
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            status,
            egui::FontId::proportional(12.0),
            egui::Color32::WHITE,
        );
    }),

    // 3. Custom edit widget — return true when the value changed
    EguiColumnExt::new("renewal").with_cell_editor(|ui, value, _theme| {
        let mut date: jiff::civil::Date = value
            .parse()
            .unwrap_or_else(|_| jiff::civil::Date::new(2026, 1, 1).unwrap());
        let response = ui.add(egui_extras::DatePickerButton::new(&mut date));
        if response.changed() {
            *value = date.to_string();
        }
        response.changed()
    }),

    // 4. Replace the default filter input with anything (combo, slider, …)
    EguiColumnExt::new("region").with_filter_renderer(|ui, ctx, term| {
        let mut changed = false;
        egui::ComboBox::from_id_salt(format!("region-filter-{}", ctx.column.name))
            .selected_text(if term.is_empty() { "All" } else { term.as_str() })
            .show_ui(ui, |ui| {
                for region in ["", "North", "South", "East", "West"] {
                    if ui.selectable_label(term == region, region).clicked() {
                        *term = region.to_string();
                        changed = true;
                    }
                }
            });
        changed
    }),

    // 5. Replace the default header sort/group/pin chrome
    EguiColumnExt::new("owner").with_header_controls_renderer(|ui, ctx, actions| {
        if ctx.can_sort && ui.small_button("Sort").clicked() {
            actions.push(EguiHeaderAction::CycleSort);
        }
        if ctx.can_pin {
            match ctx.pin_direction {
                ui_grid_core::pinning::PinDirection::None => {
                    if ui.small_button("Pin L").clicked() {
                        actions.push(EguiHeaderAction::PinLeft);
                    }
                }
                _ => {
                    if ui.small_button("Unpin").clicked() {
                        actions.push(EguiHeaderAction::Unpin);
                    }
                }
            }
        }
    }),
];
```

## Custom renderers — grid-level

`EguiGrid` carries grid-level renderer hooks for surfaces that aren't tied to one column:

```rust
use ui_grid_egui::{EguiGrid, GridGroupRowAction};

let grid = EguiGrid::new()
    // Group-row painter — chevron + label + count badge
    .with_group_row_renderer(|ui, ctx| {
        let chevron = if ctx.collapsed { "▶" } else { "▼" };
        let mut action = GridGroupRowAction::None;
        ui.horizontal(|ui| {
            ui.add_space(
                ctx.theme.cell_padding_x
                    + ctx.group.depth as f32 * ctx.theme.group_indent_per_depth,
            );
            if ui
                .selectable_label(false, egui::RichText::new(chevron).color(ctx.theme.accent))
                .clicked()
            {
                action = GridGroupRowAction::Toggle;
            }
            ui.label(
                egui::RichText::new(format!(
                    "{} = {} ({} rows)",
                    ctx.group.field, ctx.group.label, ctx.group.count
                ))
                .strong()
                .color(ctx.theme.cell_color),
            );
        });
        action
    })
    // Detail-row painter for `enable_expandable` rows
    .with_expandable_row_renderer(|ui, ctx| {
        ui.vertical(|ui| {
            ui.label(egui::RichText::new("Detail").strong().color(ctx.theme.accent));
            for col in ctx.columns {
                let value = ui_grid_core::display::format_grid_cell_display_value(ctx.row, col);
                let label = col.display_name.as_deref().unwrap_or(&col.name);
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new(format!("{label}:"))
                        .color(ctx.theme.muted_color));
                    ui.label(egui::RichText::new(value).color(ctx.theme.cell_color));
                });
            }
        });
    })
    // Empty-state painter — shows up when filters knock all rows out
    .with_empty_state_renderer(|ui, ctx| {
        ui.add_space(ctx.theme.cell_padding_y);
        ui.vertical_centered(|ui| {
            ui.label(
                egui::RichText::new(&ctx.options.labels.empty_heading)
                    .strong().size(16.0).color(ctx.theme.accent),
            );
            ui.label(
                egui::RichText::new(&ctx.options.labels.empty_description)
                    .color(ctx.theme.muted_color),
            );
        });
    })
    // Replace the synthetic selection-column checkbox
    .with_selection_checkbox_renderer(|ui, ctx, state| {
        // ctx.row: Some(&row) for per-row, None for the select-all header
        // ctx.is_header, ctx.enabled, ctx.options, ctx.theme
        let resp = ui.add_enabled(ctx.enabled, egui::Checkbox::new(state, ""));
        resp.clicked()
    });
```

## Row selection

```rust
let mut options = GridOptions {
    enable_row_selection: Some(true),
    enable_row_header_selection: Some(true), // injects the checkbox column
    enable_select_all: Some(true),
    enable_selection_batch_event: Some(true), // single batch event per drag
    ..GridOptions::default()
};

// Read selection
let selected: &[String] = grid.selected_row_ids();
```

The grid prepends a synthetic `selectionRowHeaderCol` whose width is `2 × egui::Style::spacing.icon_width` (so the checkbox is centred regardless of your egui style). The column is excluded from drag-reorder and the data-column min-width floor.

Interactions:

- Plain click → single-select.
- Ctrl/Cmd-click → additive toggle.
- Shift-click → extend range from the last clicked row.
- Drag-paint → press a row, drag across other rows; the anchor→pointer range is selected on every frame the pointer is over a different row's rect.
- `Ctrl+A` → select all selectable rows.
- `Space` → toggle the focused row.

## Validation chrome

Validators live on the column's `validators` map. Built-in validators (`required`, `minLength`, `maxLength`) short-circuit in Rust; consumer-registered validators flow through `GridValidatorRegistry`.

```rust
use serde_json::{Map, Value};
use ui_grid_core::models::GridColumnDef;

fn with_min_length(mut column: GridColumnDef, min: usize) -> GridColumnDef {
    let mut validators = Map::new();
    validators.insert("minLength".to_string(), Value::Number((min as u64).into()));
    column.validators = Some(validators);
    column
}

let columns = vec![
    with_min_length(
        GridColumnDef {
            name: "owner".into(),
            display_name: Some("Owner".into()),
            enable_cell_edit: true,
            ..GridColumnDef::default()
        },
        3,
    ),
];
```

When a cell fails validation the egui adapter paints a red border (theme `cell_invalid_border`), tints the cell background (`cell_invalid_background`), and shows the joined error messages on hover.

## Row-edit lifecycle

```rust
// Host wires save / discard buttons to the lifecycle helpers:
for id in dirty_ids {
    grid.mark_row_saving(id.clone());
    // …await save future…
    grid.mark_row_clean(&id);
    // or on failure:
    grid.mark_row_error(&id);
}

// Read the live state
let state = grid.row_edit_state();
println!("{} dirty, {} saving, {} errored",
    state.dirty_row_ids.len(),
    state.saving_row_ids.len(),
    state.error_row_ids.len(),
);
```

The egui adapter paints theme tints during cell paint: `row_dirty_background`, `row_saving_background`, `row_error_background`. Mutually-exclusive priority: error > saving > dirty.

## Benchmark probe

```rust
// Run the pipeline N times against the current options + columns and
// report wall-time averages. Same shape as TS `gridApi.core.benchmark`.
if let Some(result) = grid.run_benchmark(&options, &columns, Some(25)) {
    println!(
        "{:.2} ms avg over {} iters ({} visible rows, {} rendered items)",
        result.average_ms, result.iterations, result.visible_rows, result.rendered_items,
    );
}
```

The probe clears the rows cache up-front so a fresh benchmark context can't false-hit a stale entry from a prior call (cache keys on raw-pointer identity).

## Infinite scroll

```rust
let mut options = GridOptions {
    infinite_scroll_down: Some(true),
    infinite_scroll_rows_from_end: Some(20),
    ..GridOptions::default()
};

// Each frame, drain events and react to NeedLoadMoreData:
for event in grid.drain_events() {
    if let ui_grid_egui::EguiGridEventKind::NeedLoadMoreData = event.kind {
        let next_index = options.data.len();
        for i in 0..50 {
            options.data.push(serde_json::json!({
                "id": format!("synthetic-{}", next_index + i),
                // …
            }));
        }
        grid.mark_dirty();
    }
}
```

`NeedLoadMoreData` fires only when the host has opted in via `infinite_scroll_down` and the viewport is within `infinite_scroll_rows_from_end` of the bottom. The grid tracks the last `total_rows` value at which it emitted so the event doesn't re-fire while the viewport hovers near the bottom.

## Keyboard overrides

`KeyOverrideSpec` mirrors the TS `GridKeyEventOverride`: lets a host opt out of any built-in keydown.

```rust
use ui_grid_core::models::KeyOverrideSpec;

options.key_down_overrides = vec![
    // Suppress the built-in Ctrl+A select-all so you can route it elsewhere.
    KeyOverrideSpec {
        key: Some("a".into()),
        ctrl_key: Some(true),
        ..KeyOverrideSpec::default()
    },
];
```

## Theming

Four built-in presets:

```rust
use ui_grid_egui::{GridThemePreset, THEME_PRESETS};

for preset in THEME_PRESETS {
    println!("{}", preset.label()); // Dark, Light, Wireframe Dark, Wireframe Light
}

let theme = GridThemePreset::WireframeDark.build();
```

Override individual fields directly:

```rust
let mut theme = GridThemePreset::DefaultDark.build();
theme.row_selected_background = egui::Color32::from_rgba_unmultiplied(255, 200, 0, 60);
theme.row_selected_indicator = egui::Color32::from_rgb(255, 200, 0);
theme.cell_invalid_border = egui::Color32::from_rgb(220, 38, 38);
theme.row_dirty_background = egui::Color32::from_rgba_unmultiplied(245, 158, 11, 28);
```

Theme fields mirror the TS `--ui-grid-*` CSS variables: `border_color`, `header_background`, `pinned_header_background`, `row_odd`, `row_even`, `row_hover`, `pinned_row_background`, `cell_color`, `muted_color`, `surface`, `accent`, `pinned_indicator`, `control_hover_background`, `control_active_background`, `group_background`, `row_selected_background`, `row_selected_indicator`, `cell_invalid_border`, `cell_invalid_background`, `row_dirty_background`, `row_saving_background`, `row_error_background`, plus geometry (`radius`, `cell_padding_x/y`, `header_padding_x/y`, `row_height`, …).

## Run the demo

```sh
cargo run -p ui-grid-egui --example demo --release
```

The demo exercises every feature behind a toolbar toggle: row selection, validation (with a min-length rule on `owner`), row-edit save / discard, grouping, tree view, expandable, pinning, infinite scroll, theme switching across all four presets, the generic exporter registry (placeholder PDF), benchmark probe button, auto-fit button, and custom group / expandable / empty-state renderers.

## When to use which Rust path

- Use [Rust / WASM](./rust.md) if you want the Rust engine running in a browser host.
- Use `ui-grid-egui` if you want a native Rust desktop or egui application surface.

## See also

- [crates/ui-grid-egui/README.md](../crates/ui-grid-egui/README.md)
- [Rust / WASM](./rust.md)
- [Getting Started](./getting-started.md)
- [Native adapter roadmap](./plans/rust-c-abi-cpp-go-native-adapters.md)
