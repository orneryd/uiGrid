# ui-grid-egui

Native [egui](https://github.com/emilk/egui) widget adapter for the [`ui-grid`](https://github.com/orneryd/ui-grid) shared grid engine. Drop-in data grid with feature parity to the vanilla web component: sorting, filtering, grouping, pagination, pinning, drag-reorder, drag-resize + dblclick auto-fit, cell editing, tree view, expandable rows, row selection (checkbox + drag-paint + Ctrl+A + Space), validation chrome, row-edit lifecycle decoration, save/restore state with column widths, generic exporter registry, benchmark probe, custom renderers (cell / header / filter / group-row / expandable-row / empty-state / selection-checkbox), 100K+ row virtualization.

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
use ui_grid_egui::{EguiGrid, EguiColumnExt, GridThemePreset};
use ui_grid_core::models::GridOptions;

let mut grid = EguiGrid::new();
let theme = GridThemePreset::DefaultDark.build();
let mut column_ext: Vec<EguiColumnExt> = vec![];

// Each frame, inside your egui UI:
grid.show(ui, &mut options, &columns, &mut column_ext, &theme);
```

## Custom renderers

Per-column hooks live on `EguiColumnExt`:

```rust
use ui_grid_egui::{EguiColumnExt, EguiHeaderAction};

let ext = vec![
    // Plain text formatter
    EguiColumnExt::new("revenue")
        .with_formatter(|value, _row| format!("${}", value)),

    // Full custom cell renderer
    EguiColumnExt::new("status")
        .with_cell_renderer(|ui, ctx| {
            ui.label(ctx.value.as_str().unwrap_or(""));
        }),

    // Custom edit widget
    EguiColumnExt::new("renewal")
        .with_cell_editor(|ui, value, _theme| {
            let mut date: jiff::civil::Date = value.parse().unwrap();
            let resp = ui.add(egui_extras::DatePickerButton::new(&mut date));
            if resp.changed() { *value = date.to_string(); }
            resp.changed()
        }),

    // Replace the default filter input
    EguiColumnExt::new("region")
        .with_filter_renderer(|ui, _ctx, term| {
            ui.text_edit_singleline(term).changed()
        }),

    // Replace the default header sort/group/pin chrome
    EguiColumnExt::new("owner")
        .with_header_controls_renderer(|ui, ctx, actions| {
            if ctx.can_sort && ui.small_button("Sort").clicked() {
                actions.push(EguiHeaderAction::CycleSort);
            }
        }),
];
```

Grid-level hooks live on `EguiGrid`:

```rust
use ui_grid_egui::{EguiGrid, GridGroupRowAction};

let grid = EguiGrid::new()
    .with_group_row_renderer(|ui, ctx| {
        ui.label(format!("{}: {} ({})", ctx.group.field, ctx.group.label, ctx.group.count));
        GridGroupRowAction::None
    })
    .with_expandable_row_renderer(|ui, ctx| {
        ui.label(format!("Detail for row {}", ctx.row.id));
    })
    .with_empty_state_renderer(|ui, ctx| {
        ui.label(&ctx.options.labels.empty_heading);
    })
    .with_selection_checkbox_renderer(|ui, ctx, state| {
        ui.add_enabled(ctx.enabled, egui::Checkbox::new(state, ""))
            .clicked()
    });
```

## Generic exporter registry

```rust
use std::sync::Arc;
use ui_grid_egui::{
    register_grid_exporter, GridExportResult, GridExportScope,
    GridRegisteredExportContext,
};

register_grid_exporter("pdf", Arc::new(|ctx: &GridRegisteredExportContext<'_>| {
    GridExportResult {
        filename: format!("{}.pdf", ctx.options.id),
        content: format!("rows: {}", ctx.rows.len()).into_bytes(),
        mime_type: "application/pdf".into(),
    }
}));

let result = grid.export(&options, &columns, "pdf", GridExportScope::Visible)?;
```

CSV is auto-registered on first use.

## Benchmark probe

```rust
if let Some(result) = grid.run_benchmark(&options, &columns, Some(25)) {
    println!("{:.2} ms / iter", result.average_ms);
}
```

## Demo

```sh
cargo run -p ui-grid-egui --example demo --release
```

Exercises every feature behind a toolbar toggle (row selection, validation, row-edit, grouping, tree view, expandable, pinning, infinite scroll, theme switching, exporter registry, benchmark, auto-fit, custom renderers).

## Documentation

Full feature guide with examples for every hook: [docs/rust-egui.md](https://github.com/orneryd/ui-grid/blob/main/docs/rust-egui.md).

## License

MIT
