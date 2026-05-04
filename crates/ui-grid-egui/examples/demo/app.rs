use egui::Color32;
use ui_grid_core::{
    constants::SortDirection,
    export::build_grid_export_payload,
    models::{GridColumnDef, GridLabels, GridOptions},
    pinning::PinDirection,
};
use ui_grid_egui::{
    EguiColumnExt, EguiGrid, EguiHeaderAction, GridTheme, GridThemePreset, THEME_PRESETS,
};

use crate::columns::columns_for_dataset;
use crate::data::Dataset;
use crate::trading::{TradingState, trading_column_ext, trading_columns};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DemoLanguage {
    English,
    Spanish,
}

impl DemoLanguage {
    fn label(self) -> &'static str {
        match self {
            Self::English => "English",
            Self::Spanish => "Espanol",
        }
    }

    fn text(self, english: &'static str, spanish: &'static str) -> &'static str {
        match self {
            Self::English => english,
            Self::Spanish => spanish,
        }
    }

    fn labels(self) -> GridLabels {
        match self {
            Self::English => GridLabels::default(),
            Self::Spanish => GridLabels {
                sort_default: "Ordenar".to_string(),
                sort_asc: "Orden ascendente".to_string(),
                sort_desc: "Orden descendente".to_string(),
                group_column: "Agrupar por esta columna".to_string(),
                ungroup_column: "Quitar agrupacion".to_string(),
                group_collapse: "Contraer grupo".to_string(),
                group_expand: "Expandir grupo".to_string(),
                tree_collapse: "Contraer fila".to_string(),
                tree_expand: "Expandir fila".to_string(),
                expand_detail: "Expandir detalles".to_string(),
                collapse_detail: "Contraer detalles".to_string(),
                filter_placeholder: "Filtrar...".to_string(),
                filter_disabled: "Filtro deshabilitado".to_string(),
                filter_column: "Filtro".to_string(),
                pagination_previous: "Pagina anterior".to_string(),
                pagination_next: "Pagina siguiente".to_string(),
                pagination_page: "Pagina".to_string(),
                pagination_of: "de".to_string(),
                pagination_rows: "Filas por pagina".to_string(),
                empty_heading: "No hay filas coincidentes".to_string(),
                empty_description: "Ajusta los filtros, la agrupacion o el orden.".to_string(),
                toolbar_of: "de".to_string(),
                toolbar_rows: "filas".to_string(),
                stats_visible_rows: "filas visibles".to_string(),
                group_rows_suffix: "filas".to_string(),
                pin_column: "Fijar columna".to_string(),
                pin_left: "Fijar a la izquierda".to_string(),
                pin_right: "Fijar a la derecha".to_string(),
                unpin: "Desfijar".to_string(),
            },
        }
    }
}

#[derive(Debug, Clone)]
struct ExportPreview {
    filename: String,
    mime_type: String,
    contents: String,
}

pub struct DemoApp {
    grid: EguiGrid,
    options: GridOptions,
    columns: Vec<GridColumnDef>,
    column_ext: Vec<EguiColumnExt>,
    dataset: Dataset,
    theme_preset: GridThemePreset,
    theme: GridTheme,
    language: DemoLanguage,
    enable_grouping: bool,
    enable_pinning: bool,
    enable_expandable: bool,
    enable_tree_view: bool,
    enable_pagination: bool,
    use_custom_header_controls: bool,
    serialized_state: Option<String>,
    export_preview: Option<ExportPreview>,
    trading: TradingState,
}

impl DemoApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let dataset = Dataset::Flat;
        let language = DemoLanguage::English;
        let columns = columns_for_dataset(dataset);
        let options = build_options(
            dataset, &columns, language, false, true, false, false, false,
        );
        let theme_preset = GridThemePreset::DefaultDark;

        Self {
            grid: EguiGrid::new(),
            options,
            columns,
            column_ext: build_column_extensions(false),
            dataset,
            theme_preset,
            theme: theme_preset.build(),
            language,
            enable_grouping: false,
            enable_pinning: true,
            enable_expandable: false,
            enable_tree_view: false,
            enable_pagination: false,
            use_custom_header_controls: false,
            serialized_state: None,
            export_preview: None,
            trading: TradingState::new(),
        }
    }

    fn rebuild_options(&mut self) {
        if self.dataset == Dataset::Trading {
            self.columns = trading_columns();
            self.options = GridOptions {
                id: "trading-grid".to_string(),
                data: self.trading.rows(),
                column_defs: self.columns.clone(),
                labels: self.language.labels(),
                enable_sorting: true,
                enable_filtering: true,
                enable_grouping: false,
                enable_column_moving: true,
                enable_pinning: true,
                row_id_field: Some("id".to_string()),
                ..GridOptions::default()
            };
            self.column_ext = trading_column_ext();
            self.grid.reset();
            return;
        }
        self.columns = columns_for_dataset(self.dataset);
        self.options = build_options(
            self.dataset,
            &self.columns,
            self.language,
            self.enable_grouping,
            self.enable_pinning,
            self.enable_expandable,
            self.enable_tree_view,
            self.enable_pagination,
        );
        self.column_ext = build_column_extensions(self.use_custom_header_controls);
        self.grid.reset();
    }
}

#[allow(clippy::too_many_arguments)]
fn build_options(
    dataset: Dataset,
    columns: &[GridColumnDef],
    language: DemoLanguage,
    enable_grouping: bool,
    enable_pinning: bool,
    enable_expandable: bool,
    enable_tree_view: bool,
    enable_pagination: bool,
) -> GridOptions {
    GridOptions {
        id: "demo-grid".to_string(),
        data: dataset.rows(),
        column_defs: columns.to_vec(),
        labels: language.labels(),
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: enable_grouping && !enable_tree_view,
        enable_column_moving: true,
        enable_pinning,
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

fn with_custom_header_controls(ext: EguiColumnExt) -> EguiColumnExt {
    ext.with_header_controls_renderer(|ui, ctx, actions| {
        if ctx.can_sort
            && ui
                .small_button("Sort")
                .on_hover_text(sort_label(ctx))
                .clicked()
        {
            actions.push(EguiHeaderAction::CycleSort);
        }

        if ctx.can_group {
            let label = if ctx.is_grouped {
                &ctx.labels.ungroup_column
            } else {
                &ctx.labels.group_column
            };
            let text = if ctx.is_grouped { "Ungroup" } else { "Group" };
            if ui.small_button(text).on_hover_text(label).clicked() {
                actions.push(EguiHeaderAction::ToggleGrouping);
            }
        }

        if ctx.can_pin {
            match ctx.pin_direction {
                PinDirection::Left | PinDirection::Right => {
                    if ui
                        .small_button("Unpin")
                        .on_hover_text(&ctx.labels.unpin)
                        .clicked()
                    {
                        actions.push(EguiHeaderAction::Unpin);
                    }
                }
                PinDirection::None => {
                    if ui
                        .small_button("Pin L")
                        .on_hover_text(&ctx.labels.pin_left)
                        .clicked()
                    {
                        actions.push(EguiHeaderAction::PinLeft);
                    }
                    if ui
                        .small_button("Pin R")
                        .on_hover_text(&ctx.labels.pin_right)
                        .clicked()
                    {
                        actions.push(EguiHeaderAction::PinRight);
                    }
                }
            }
        }
    })
}

fn sort_label<'a>(ctx: &'a ui_grid_egui::GridHeaderControlsContext<'a>) -> &'a str {
    match ctx.sort_direction {
        SortDirection::Asc => &ctx.labels.sort_asc,
        SortDirection::Desc => &ctx.labels.sort_desc,
        SortDirection::None => &ctx.labels.sort_default,
    }
}

fn build_column_extensions(use_custom_header_controls: bool) -> Vec<EguiColumnExt> {
    let status_ext = EguiColumnExt::new("status").with_cell_renderer(|ui, ctx| {
        let status = ctx.value.as_str().unwrap_or("Unknown");
        let (bg, fg) = match status {
            "Active" => (Color32::from_rgb(0x10, 0xB9, 0x81), Color32::WHITE),
            "Trial" => (
                Color32::from_rgb(0x38, 0xBD, 0xF8),
                Color32::from_rgb(0x0B, 0x18, 0x24),
            ),
            "Churned" => (Color32::from_rgb(0xEF, 0x44, 0x44), Color32::WHITE),
            "Suspended" => (
                Color32::from_rgb(0xF5, 0x9E, 0x0B),
                Color32::from_rgb(0x0B, 0x18, 0x24),
            ),
            _ => (ctx.theme.muted_color, ctx.theme.cell_color),
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
            fg,
        );
    });

    let revenue_ext = EguiColumnExt::new("revenue").with_formatter(|value, _row| {
        let amount = value
            .as_f64()
            .or_else(|| value.as_i64().map(|v| v as f64))
            .unwrap_or(0.0);
        format!("${}", format_with_commas(amount as i64))
    });

    let enabled_ext = EguiColumnExt::new("enabled").with_cell_renderer(|ui, ctx| {
        let mut enabled = ctx.value.as_bool().unwrap_or(false);
        ui.add_enabled(false, egui::Checkbox::without_text(&mut enabled));
    });

    let renewal_ext = EguiColumnExt::new("renewal").with_cell_editor(|ui, value, _theme| {
        let mut date: jiff::civil::Date = value
            .parse()
            .unwrap_or_else(|_| jiff::civil::Date::new(2026, 1, 1).unwrap());
        let response = ui.add(egui_extras::DatePickerButton::new(&mut date));
        if response.changed() {
            *value = date.to_string();
        }
        response.changed()
    });

    if use_custom_header_controls {
        vec![
            with_custom_header_controls(EguiColumnExt::new("owner")),
            with_custom_header_controls(status_ext),
            with_custom_header_controls(revenue_ext),
            with_custom_header_controls(enabled_ext),
            with_custom_header_controls(renewal_ext),
            with_custom_header_controls(EguiColumnExt::new("tier")),
        ]
    } else {
        vec![status_ext, revenue_ext, enabled_ext, renewal_ext]
    }
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

        // ── live tick for trading mode ────────────────────────────────────────
        let is_trading = self.dataset == Dataset::Trading;
        if is_trading && self.trading.running {
            let now = ui.ctx().input(|i| i.time);
            self.trading.update_fps(now);
            self.trading.tick();
            // push updated rows into grid options and re-run the pipeline
            self.options.data = self.trading.rows();
            self.grid.mark_dirty();
            // request repaint to keep ticking at display refresh rate
            ui.ctx().request_repaint();
        }

        egui::Panel::top("toolbar").show_inside(ui, |ui| {
            let mut options_changed = false;

            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;

                ui.label(self.language.text("Language:", "Idioma:"));
                let previous_language = self.language;
                egui::ComboBox::from_id_salt("language")
                    .selected_text(self.language.label())
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut self.language, DemoLanguage::English, "English");
                        ui.selectable_value(&mut self.language, DemoLanguage::Spanish, "Espanol");
                    });
                if self.language != previous_language {
                    options_changed = true;
                }

                ui.separator();

                ui.label(self.language.text("Dataset:", "Datos:"));
                let previous_dataset = self.dataset;
                egui::ComboBox::from_id_salt("dataset")
                    .selected_text(self.dataset.label())
                    .show_ui(ui, |ui| {
                        for dataset in [
                            Dataset::Flat,
                            Dataset::Tree,
                            Dataset::Large,
                            Dataset::Huge,
                            Dataset::Trading,
                        ] {
                            ui.selectable_value(&mut self.dataset, dataset, dataset.label());
                        }
                    });
                if self.dataset != previous_dataset {
                    options_changed = true;
                }

                ui.separator();

                if ui
                    .checkbox(
                        &mut self.use_custom_header_controls,
                        self.language
                            .text("Custom controls", "Controles personalizados"),
                    )
                    .changed()
                {
                    options_changed = true;
                }

                if ui
                    .checkbox(
                        &mut self.enable_grouping,
                        self.language.text("Group", "Agrupar"),
                    )
                    .changed()
                {
                    if self.enable_grouping {
                        self.enable_tree_view = false;
                    }
                    options_changed = true;
                }

                if ui
                    .checkbox(
                        &mut self.enable_pinning,
                        self.language.text("Pinning", "Fijacion"),
                    )
                    .changed()
                {
                    options_changed = true;
                }

                if ui
                    .checkbox(
                        &mut self.enable_tree_view,
                        self.language.text("Tree", "Arbol"),
                    )
                    .changed()
                {
                    if self.enable_tree_view {
                        self.enable_grouping = false;
                        self.dataset = Dataset::Tree;
                    }
                    options_changed = true;
                }

                if ui
                    .checkbox(
                        &mut self.enable_pagination,
                        self.language.text("Paginate", "Paginar"),
                    )
                    .changed()
                {
                    options_changed = true;
                }

                if ui
                    .checkbox(
                        &mut self.enable_expandable,
                        self.language.text("Expandable", "Expandible"),
                    )
                    .changed()
                {
                    options_changed = true;
                }
            });

            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;

                if self.enable_grouping {
                    ui.label(self.language.text("Group by:", "Agrupar por:"));
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

                ui.label(self.language.text("Theme:", "Tema:"));
                let previous_preset = self.theme_preset;
                for &preset in THEME_PRESETS {
                    if ui
                        .selectable_label(self.theme_preset == preset, preset.label())
                        .clicked()
                    {
                        self.theme_preset = preset;
                    }
                }
                if self.theme_preset != previous_preset {
                    self.theme = self.theme_preset.build();
                }

                ui.separator();

                if ui
                    .button(self.language.text("Save state", "Guardar estado"))
                    .clicked()
                {
                    self.serialized_state = self.grid.serialize_state().ok();
                }

                if ui
                    .add_enabled(
                        self.serialized_state.is_some(),
                        egui::Button::new(self.language.text("Restore state", "Restaurar estado")),
                    )
                    .clicked()
                    && let Some(value) = self.serialized_state.as_deref()
                {
                    let _ = self.grid.deserialize_state(value);
                }

                if ui
                    .button(self.language.text("Export CSV", "Exportar CSV"))
                    .clicked()
                {
                    let payload = self.grid.export_csv(&self.options, &self.columns);
                    self.export_preview = Some(ExportPreview {
                        filename: payload.filename,
                        mime_type: payload.mime_type,
                        contents: payload.contents,
                    });
                }

                if ui
                    .button(
                        self.language
                            .text("Export custom", "Exportar personalizado"),
                    )
                    .clicked()
                {
                    let payload = self
                        .grid
                        .export_with(&self.options, &self.columns, |context| {
                            let contents = context
                                .rows
                                .iter()
                                .map(|row| {
                                    format!(
                                        "{} | {}",
                                        row.id,
                                        context
                                            .columns
                                            .iter()
                                            .map(|column| {
                                                let field =
                                                    column.field.as_deref().unwrap_or(&column.name);
                                                format!("{}={}", column.name, row.entity[field])
                                            })
                                            .collect::<Vec<_>>()
                                            .join("; ")
                                    )
                                })
                                .collect::<Vec<_>>()
                                .join("\n");

                            build_grid_export_payload(
                                format!("{}-desktop.txt", context.grid_id.replace('/', "_")),
                                "text/plain;charset=utf-8",
                                contents,
                            )
                        });

                    self.export_preview = Some(ExportPreview {
                        filename: payload.filename,
                        mime_type: payload.mime_type,
                        contents: payload.contents,
                    });
                }

                ui.separator();

                // ── trading terminal controls ─────────────────────────────────
                if is_trading {
                    let btn_label = if self.trading.running {
                        "⏸ Pause"
                    } else {
                        "▶ Resume"
                    };
                    if ui.button(btn_label).clicked() {
                        self.trading.running = !self.trading.running;
                    }

                    ui.label("Updates/tick:");
                    let n = self.trading.instruments.len();
                    let mut upd = self.trading.updates_per_tick;
                    if ui
                        .add(egui::Slider::new(&mut upd, 1..=n).text("rows"))
                        .changed()
                    {
                        self.trading.updates_per_tick = upd;
                    }

                    ui.separator();

                    let tick_color = if self.trading.running {
                        Color32::from_rgb(0x22, 0xC5, 0x5E)
                    } else {
                        Color32::from_rgb(0xEF, 0x44, 0x44)
                    };
                    ui.colored_label(
                        tick_color,
                        format!("Tick #{} | {:.1} fps", self.trading.ticks, self.trading.fps,),
                    );

                    ui.separator();
                }

                let result = self.grid.result();
                let virtualization = if result.virtualization_enabled {
                    "on"
                } else {
                    "off"
                };
                ui.label(format!(
                    "{:.2}ms | {} {} | virt: {}",
                    result.pipeline_ms,
                    result.total_items,
                    self.options.labels.toolbar_rows,
                    virtualization
                ));
            });

            if let Some(serialized_state) = &self.serialized_state {
                ui.separator();
                ui.collapsing(
                    self.language.text("Serialized state", "Estado serializado"),
                    |ui| {
                        ui.monospace(serialized_state);
                    },
                );
            }

            if let Some(preview) = &self.export_preview {
                ui.separator();
                ui.collapsing(
                    self.language
                        .text("Export preview", "Vista previa de exportacion"),
                    |ui| {
                        ui.label(format!("{} ({})", preview.filename, preview.mime_type));
                        ui.monospace(&preview.contents);
                    },
                );
            }

            if options_changed {
                self.rebuild_options();
            }
        });

        egui::CentralPanel::default().show_inside(ui, |ui| {
            self.grid.show(
                ui,
                &mut self.options,
                &self.columns,
                &mut self.column_ext,
                &self.theme,
            );
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
