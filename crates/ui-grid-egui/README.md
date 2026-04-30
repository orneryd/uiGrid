# ui-grid-egui

Native [egui](https://github.com/emilk/egui) widget adapter for the [`@ornery/ui-grid`](https://github.com/ornerydev/ui-grid) deterministic grid pipeline. Drop-in data grid with sorting, filtering, grouping, cell editing, tree view, pagination, row selection, and 100K+ row virtualization.

## Usage

```toml
[dependencies]
ui-grid-egui = "0.1"
ui-grid-core = "0.1"
```

```rust
use ui_grid_egui::{EguiGrid, EguiColumnExt, GridTheme, GridThemePreset};
use ui_grid_core::models::{GridOptions, GridColumnDef};

// Create the grid once
let mut grid = EguiGrid::new();
let theme = GridThemePreset::DefaultDark.build();
let mut column_ext: Vec<EguiColumnExt> = vec![];

// Each frame, inside your egui UI:
grid.show(ui, &mut options, &columns, &mut column_ext, &theme);
```

### Custom cell formatters / renderers / editors

```rust
let ext = vec![
    // Plain text formatter
    EguiColumnExt::new("revenue")
        .with_formatter(|value, _row| format!("${}", value)),

    // Full custom renderer
    EguiColumnExt::new("status")
        .with_cell_renderer(|ui, ctx| {
            ui.label(ctx.value.as_str().unwrap_or(""));
        }),

    // Custom edit widget
    EguiColumnExt::new("date")
        .with_cell_editor(|ui, value, _theme| {
            let response = ui.text_edit_singleline(value);
            response.changed()
        }),
];
```

## Demo

```sh
cargo run -p ui-grid-egui --example demo --release
```

### Building the demo locally

Prerequisites: [Rust 1.95+](https://rustup.rs/)

```sh
git clone https://github.com/orneryd/uiGrid.git
cd uiGrid
cargo run -p ui-grid-egui --example demo --release
```

The demo app showcases:
- Column sorting (click header), filtering (type in filter row), and grouping
- Custom cell renderers (status pills, currency formatting, boolean checkboxes)
- Cell editing via double-click or Enter, including a date picker widget
- Tree view with expandable/collapsible rows
- Theme switching (4 built-in presets)
- Smooth scrolling with 100K+ row virtualization

## License

MIT

## Roadmap

- Drag and drop reorderable columns
