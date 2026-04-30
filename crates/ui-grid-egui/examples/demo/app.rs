use egui::Color32;
use ui_grid_core::models::{GridColumnDef, GridOptions};
use ui_grid_egui::{EguiColumnExt, EguiGrid, GridTheme, GridThemePreset, THEME_PRESETS};

use crate::columns::columns_for_dataset;
use crate::data::Dataset;

pub struct DemoApp {
    grid: EguiGrid,
    options: GridOptions,
    columns: Vec<GridColumnDef>,
    column_ext: Vec<EguiColumnExt>,
    dataset: Dataset,
    theme_preset: GridThemePreset,
    theme: GridTheme,
    enable_grouping: bool,
    enable_expandable: bool,
    enable_tree_view: bool,
    enable_pagination: bool,
}

impl DemoApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let dataset = Dataset::Flat;
        let columns = columns_for_dataset(dataset);
        let options = build_options(dataset, &columns, false, false, false, false);
        let theme_preset = GridThemePreset::DefaultDark;
        Self {
            grid: EguiGrid::new(),
            options,
            columns,
            column_ext: build_column_extensions(),
            dataset,
            theme_preset,
            theme: theme_preset.build(),
            enable_grouping: false,
            enable_expandable: false,
            enable_tree_view: false,
            enable_pagination: false,
        }
    }

    fn rebuild_options(&mut self) {
        self.columns = columns_for_dataset(self.dataset);
        self.options = build_options(
            self.dataset,
            &self.columns,
            self.enable_grouping,
            self.enable_expandable,
            self.enable_tree_view,
            self.enable_pagination,
        );
        self.grid.reset();
    }
}

fn build_options(
    dataset: Dataset,
    columns: &[GridColumnDef],
    enable_grouping: bool,
    enable_expandable: bool,
    enable_tree_view: bool,
    enable_pagination: bool,
) -> GridOptions {
    GridOptions {
        id: "demo-grid".to_string(),
        data: dataset.rows(),
        column_defs: columns.to_vec(),
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: enable_grouping && !enable_tree_view,
        enable_pagination,
        pagination_page_size: if enable_pagination { Some(10) } else { None },
        enable_expandable: enable_expandable && !enable_tree_view,
        enable_tree_view,
        enable_cell_edit: true,
        tree_children_field: Some("children".to_string()),
        row_id_field: Some("id".to_string()),
        ..GridOptions::default()
    }
}

fn build_column_extensions() -> Vec<EguiColumnExt> {
    vec![
        EguiColumnExt::new("status").with_cell_renderer(|ui, ctx| {
            let status = ctx.value.as_str().unwrap_or("Unknown");
            let (bg, fg) = match status {
                "Active" => (
                    Color32::from_rgb(0x10, 0xB9, 0x81),
                    Color32::WHITE,
                ),
                "Trial" => (
                    Color32::from_rgb(0x38, 0xBD, 0xF8),
                    Color32::from_rgb(0x0B, 0x18, 0x24),
                ),
                "Churned" => (
                    Color32::from_rgb(0xEF, 0x44, 0x44),
                    Color32::WHITE,
                ),
                "Suspended" => (
                    Color32::from_rgb(0xF5, 0x9E, 0x0B),
                    Color32::from_rgb(0x0B, 0x18, 0x24),
                ),
                _ => (ctx.theme.muted_color, ctx.theme.cell_color),
            };
            let (rect, _) = ui.allocate_exact_size(
                egui::Vec2::new(ui.available_width().min(80.0), 20.0),
                egui::Sense::hover(),
            );
            ui.painter().rect_filled(rect, 10.0, bg);
            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                status,
                egui::FontId::proportional(12.0),
                fg,
            );
        }),
        EguiColumnExt::new("revenue").with_formatter(|value, _row| {
            let n = value
                .as_f64()
                .or_else(|| value.as_i64().map(|i| i as f64))
                .unwrap_or(0.0);
            let int_part = n as i64;
            format!("${}", format_with_commas(int_part))
        }),
        EguiColumnExt::new("enabled").with_cell_renderer(|ui, ctx| {
            let enabled = ctx.value.as_bool().unwrap_or(false);
            let icon = if enabled { "\u{2611}" } else { "\u{2610}" };
            ui.label(egui::RichText::new(icon).color(ctx.theme.cell_color).size(16.0));
        }),
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
    ]
}

fn format_with_commas(n: i64) -> String {
    let s = n.abs().to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    if n < 0 {
        result.push('-');
    }
    result.chars().rev().collect()
}

impl eframe::App for DemoApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        apply_egui_visuals(ui.ctx(), &self.theme);

        egui::Panel::top("toolbar").show_inside(ui, |ui| {
            let mut options_changed = false;

            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;

                ui.label("Dataset:");
                let prev = self.dataset;
                egui::ComboBox::from_id_salt("dataset")
                    .selected_text(self.dataset.label())
                    .show_ui(ui, |ui| {
                        for ds in &[
                            Dataset::Flat,
                            Dataset::Tree,
                            Dataset::Large,
                            Dataset::Huge,
                        ] {
                            ui.selectable_value(&mut self.dataset, *ds, ds.label());
                        }
                    });
                if self.dataset != prev {
                    options_changed = true;
                }

                ui.separator();

                let grouping_changed =
                    ui.checkbox(&mut self.enable_grouping, "Group").changed();
                if grouping_changed && self.enable_grouping {
                    self.enable_tree_view = false;
                    options_changed = true;
                } else if grouping_changed {
                    options_changed = true;
                }

                let tree_changed =
                    ui.checkbox(&mut self.enable_tree_view, "Tree").changed();
                if tree_changed && self.enable_tree_view {
                    self.enable_grouping = false;
                    if self.dataset != Dataset::Tree {
                        self.dataset = Dataset::Tree;
                    }
                    options_changed = true;
                } else if tree_changed {
                    options_changed = true;
                }

                if ui
                    .checkbox(&mut self.enable_pagination, "Paginate")
                    .changed()
                {
                    options_changed = true;
                }

                if ui
                    .checkbox(&mut self.enable_expandable, "Expandable")
                    .changed()
                {
                    options_changed = true;
                }
            });

            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;

                if self.enable_grouping {
                    ui.label("Group by:");
                    let mut group_cols = self.grid.group_by_columns().to_vec();
                    let mut group_changed = false;
                    for col in &self.columns {
                        let mut checked = group_cols.contains(&col.name);
                        if ui.checkbox(&mut checked, &col.name).changed() {
                            if checked {
                                group_cols.push(col.name.clone());
                            } else {
                                group_cols.retain(|c| c != &col.name);
                            }
                            group_changed = true;
                        }
                    }
                    if group_changed {
                        self.grid.set_group_by(group_cols);
                    }
                    ui.separator();
                }

                ui.label("Theme:");
                let prev_preset = self.theme_preset;
                for &preset in THEME_PRESETS {
                    if ui
                        .selectable_label(self.theme_preset == preset, preset.label())
                        .clicked()
                    {
                        self.theme_preset = preset;
                    }
                }
                if self.theme_preset != prev_preset {
                    self.theme = self.theme_preset.build();
                }

                ui.separator();
                let r = self.grid.result();
                let virt = if r.virtualization_enabled { "on" } else { "off" };
                ui.label(format!(
                    "{:.2}ms | {} rows | virt: {}",
                    r.pipeline_ms, r.total_items, virt
                ));
            });

            if options_changed {
                self.rebuild_options();
            }
        });

        egui::CentralPanel::default().show_inside(ui, |ui| {
            self.grid
                .show(ui, &mut self.options, &self.columns, &mut self.column_ext, &self.theme);
        });
    }
}

fn apply_egui_visuals(ctx: &egui::Context, theme: &GridTheme) {
    let is_dark = theme.surface.r() < 128;
    let mut visuals = if is_dark {
        egui::Visuals::dark()
    } else {
        egui::Visuals::light()
    };
    visuals.selection.bg_fill = theme.accent;
    visuals.selection.stroke = egui::Stroke::new(1.0, theme.accent);
    visuals.hyperlink_color = theme.accent;
    visuals.widgets.active.bg_fill = theme.accent;
    visuals.widgets.hovered.bg_stroke = egui::Stroke::new(1.0, theme.accent);
    visuals.panel_fill = theme.surface;
    visuals.window_fill = theme.surface;
    visuals.override_text_color = Some(theme.cell_color);
    ctx.set_visuals(visuals);
}
