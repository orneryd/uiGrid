# Rust / egui

`ui-grid-egui` is the native Rust adapter for UI Grid on top of `egui`.

It wraps the deterministic grid model with an `egui` widget layer so Rust applications can render the grid natively without a browser or JavaScript runtime.

## Install

Add the published crates to your Rust application:

```toml
[dependencies]
ui-grid-egui = "0.1"
ui-grid-core = "0.1"
```

## Minimal Usage

```rust
use ui_grid_egui::{EguiGrid, EguiColumnExt, GridThemePreset};
use ui_grid_core::models::{GridColumnDef, GridOptions};

let mut grid = EguiGrid::new();
let theme = GridThemePreset::DefaultDark.build();
let mut column_ext: Vec<EguiColumnExt> = vec![];

// Inside your egui frame:
grid.show(ui, &mut options, &columns, &mut column_ext, &theme);
```

The main exported surface is:

- `EguiGrid` — the widget entry point
- `EguiColumnExt` — per-column native egui extensions for rendering and editing
- `GridTheme` / `GridThemePreset` — theme configuration for the native widget
- `EguiGridEvent` / `EguiGridEventKind` — native event model for egui hosts

## What The egui Adapter Supports

- sorting, filtering, grouping, and pagination
- cell editing and focus management
- tree view and expandable rows
- large dataset virtualization
- theme presets and custom column extensions

## Column Extensions

`EguiColumnExt` is the main customization hook for native Rust apps.

Use it to add:

- formatters for display values
- custom cell renderers
- custom edit widgets

```rust
let ext = vec![
    EguiColumnExt::new("revenue")
        .with_formatter(|value, _row| format!("${}", value)),

    EguiColumnExt::new("status")
        .with_cell_renderer(|ui, ctx| {
            ui.label(ctx.value.as_str().unwrap_or(""));
        }),

    EguiColumnExt::new("date")
        .with_cell_editor(|ui, value, _theme| {
            let response = ui.text_edit_singleline(value);
            response.changed()
        }),
];
```

## Run The Native Demo

From the monorepo root:

```bash
cargo run -p ui-grid-egui --example demo --release
```

That demo showcases:

- sorting, filtering, and grouping
- custom renderers and editors
- tree view and expandable behavior
- theme switching with built-in presets
- large dataset scrolling and virtualization

## When To Use Which Rust Path

- Use [Rust / WASM](./rust.md) if you want the Rust engine running in a browser host.
- Use `ui-grid-egui` if you want a native Rust desktop or egui application surface.

Today these are complementary paths:

- Rust/WASM is the browser-native engine delivery path
- `ui-grid-egui` is the native Rust widget adapter

## See Also

- [crates/ui-grid-egui/README.md](../crates/ui-grid-egui/README.md)
- [Rust / WASM](./rust.md)
- [Getting Started](./getting-started.md)