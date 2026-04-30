#![allow(dead_code)]

use std::collections::BTreeMap;

use egui::{Color32, Key, Pos2, Ui, Vec2};
use egui_extras::{Column, TableBuilder};
use serde_json::Value;
use ui_grid_core::{
    constants::SortDirection,
    display::format_grid_cell_display_value,
    edit::{
        begin_grid_edit_session, find_next_grid_cell, parse_grid_edited_value,
        stringify_grid_editor_value, GridEditSession, GridMoveDirection,
    },
    models::{
        BuildGridPipelineContext, DisplayItem, GridCellPosition, GridColumnDef,
        GridGroupingOptions, GridOptions, PipelineResult, RowItem, SortState,
    },
    pagination::get_total_pages_value,
    pipeline::build_grid_pipeline,
    utils::get_cell_value,
};

use crate::grid_theme::GridTheme;
use crate::column_ext::{find_column_ext, find_column_ext_mut, EguiColumnExt, GridCellContext};

fn paint_triangle(painter: &egui::Painter, center: Pos2, half: f32, dir: TriDir, color: Color32) {
    let points = match dir {
        TriDir::Right => vec![
            Pos2::new(center.x - half * 0.5, center.y - half),
            Pos2::new(center.x + half * 0.7, center.y),
            Pos2::new(center.x - half * 0.5, center.y + half),
        ],
        TriDir::Down => vec![
            Pos2::new(center.x - half, center.y - half * 0.5),
            Pos2::new(center.x + half, center.y - half * 0.5),
            Pos2::new(center.x, center.y + half * 0.7),
        ],
        TriDir::Up => vec![
            Pos2::new(center.x - half, center.y + half * 0.5),
            Pos2::new(center.x + half, center.y + half * 0.5),
            Pos2::new(center.x, center.y - half * 0.7),
        ],
    };
    painter.add(egui::Shape::convex_polygon(points, color, egui::Stroke::NONE));
}

fn paint_hamburger(painter: &egui::Painter, center: Pos2, half: f32, color: Color32) {
    for i in [-1.0_f32, 0.0, 1.0] {
        let y = center.y + i * half * 0.6;
        painter.line_segment(
            [Pos2::new(center.x - half, y), Pos2::new(center.x + half, y)],
            egui::Stroke::new(1.5, color),
        );
    }
}

fn paint_grid_icon(painter: &egui::Painter, center: Pos2, half: f32, color: Color32) {
    let s = half * 0.45;
    let gap = half * 0.2;
    for dx in [-1.0_f32, 1.0] {
        for dy in [-1.0_f32, 1.0] {
            let cx = center.x + dx * (s + gap);
            let cy = center.y + dy * (s + gap);
            let r = egui::Rect::from_center_size(Pos2::new(cx, cy), Vec2::splat(s * 2.0));
            painter.rect_filled(r, 1.0, color);
        }
    }
}

fn icon_button(ui: &mut Ui, icon: IconKind, color: Color32) -> egui::Response {
    let size = Vec2::splat(16.0);
    let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());
    if ui.is_rect_visible(rect) {
        let c = rect.center();
        let h = 5.0;
        match icon {
            IconKind::SortNone => paint_hamburger(ui.painter(), c, h, color),
            IconKind::SortAsc => paint_triangle(ui.painter(), c, h, TriDir::Up, color),
            IconKind::SortDesc => paint_triangle(ui.painter(), c, h, TriDir::Down, color),
            IconKind::Group => paint_grid_icon(ui.painter(), c, h, color),
            IconKind::ExpandRight => paint_triangle(ui.painter(), c, h * 0.8, TriDir::Right, color),
            IconKind::ExpandDown => paint_triangle(ui.painter(), c, h * 0.8, TriDir::Down, color),
        }
    }
    response
}

enum TriDir { Right, Down, Up }

enum IconKind {
    SortNone,
    SortAsc,
    SortDesc,
    Group,
    ExpandRight,
    ExpandDown,
}

#[derive(Debug, Clone)]
pub struct EguiGridEvent {
    pub kind: EguiGridEventKind,
}

#[derive(Debug, Clone)]
pub enum EguiGridEventKind {
    SortChanged { column: String, direction: SortDirection },
    FilterChanged { column: String, term: String },
    PageChanged { page: usize },
    GroupToggled { group_id: String, collapsed: bool },
    RowExpanded { row_id: String, expanded: bool },
    TreeNodeToggled { row_id: String, expanded: bool },
    CellEdited { row_id: String, column: String, old_value: Value, new_value: Value },
    SelectionChanged { selected_ids: Vec<String> },
    RenderingComplete { pipeline_ms: f64, total_items: usize },
}

pub struct EguiGrid {
    sort_state: SortState,
    active_filters: BTreeMap<String, String>,
    group_by_columns: Vec<String>,
    collapsed_groups: BTreeMap<String, bool>,
    expanded_rows: BTreeMap<String, bool>,
    expanded_tree_rows: BTreeMap<String, bool>,
    current_page: usize,
    page_size: usize,
    pipeline_dirty: bool,
    cached_result: PipelineResult,
    events: Vec<EguiGridEvent>,

    edit_session: Option<GridEditSession>,
    focused_cell: Option<GridCellPosition>,
    selected_row_ids: Vec<String>,
    last_clicked_row_id: Option<String>,
}

impl Default for EguiGrid {
    fn default() -> Self {
        Self::new()
    }
}

impl EguiGrid {
    pub fn new() -> Self {
        Self {
            sort_state: SortState {
                column_name: None,
                direction: SortDirection::None,
            },
            active_filters: BTreeMap::new(),
            group_by_columns: Vec::new(),
            collapsed_groups: BTreeMap::new(),
            expanded_rows: BTreeMap::new(),
            expanded_tree_rows: BTreeMap::new(),
            current_page: 1,
            page_size: 10,
            pipeline_dirty: true,
            cached_result: PipelineResult::default(),
            events: Vec::new(),
            edit_session: None,
            focused_cell: None,
            selected_row_ids: Vec::new(),
            last_clicked_row_id: None,
        }
    }

    pub fn result(&self) -> &PipelineResult {
        &self.cached_result
    }

    pub fn drain_events(&mut self) -> Vec<EguiGridEvent> {
        std::mem::take(&mut self.events)
    }

    pub fn sort_state(&self) -> &SortState {
        &self.sort_state
    }

    pub fn set_page_size(&mut self, size: usize) {
        self.page_size = size;
        self.current_page = 1;
        self.pipeline_dirty = true;
    }

    pub fn group_by_columns(&self) -> &[String] {
        &self.group_by_columns
    }

    pub fn set_group_by(&mut self, columns: Vec<String>) {
        self.group_by_columns = columns;
        self.pipeline_dirty = true;
    }

    pub fn reset(&mut self) {
        *self = Self {
            page_size: self.page_size,
            ..Self::new()
        };
    }

    pub fn show(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        theme: &GridTheme,
    ) {
        self.handle_keyboard_navigation(ui, options, columns);
        self.refresh_pipeline(options, columns);

        if columns.is_empty() {
            ui.label("No columns defined.");
            return;
        }

        let total_items = self.cached_result.total_items;
        let display_items = std::mem::take(&mut self.cached_result.display_items);

        egui::Frame::new()
            .fill(theme.surface)
            .stroke(egui::Stroke::new(1.0, theme.border_color))
            .corner_radius(theme.radius)
            .show(ui, |ui| {
                if options.enable_pagination {
                    egui::Panel::bottom(ui.id().with("grid_pagination"))
                        .exact_size(36.0)
                        .show_inside(ui, |ui| {
                            self.draw_pagination(ui, options, total_items, theme);
                        });
                }

                self.draw_table(ui, options, columns, column_ext, &display_items, theme);
            });

        self.cached_result.display_items = display_items;
    }

    fn handle_keyboard_navigation(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
    ) {
        let input = ui.input(|i| {
            (
                i.key_pressed(Key::Tab),
                i.key_pressed(Key::Enter),
                i.key_pressed(Key::Escape),
                i.key_pressed(Key::ArrowUp),
                i.key_pressed(Key::ArrowDown),
                i.key_pressed(Key::ArrowLeft),
                i.key_pressed(Key::ArrowRight),
                i.modifiers.shift,
            )
        });
        let (tab, enter, escape, up, down, left, right, shift) = input;

        if escape {
            if self.edit_session.is_some() {
                self.edit_session = None;
                return;
            }
        }

        if enter && self.edit_session.is_some() {
            self.commit_edit(options, columns);
            if let Some(ref focused) = self.focused_cell {
                if let Some(next) = find_next_grid_cell(
                    &self.cached_result.visible_rows,
                    columns,
                    &focused.row_id,
                    &focused.column_name,
                    GridMoveDirection::Down,
                    None::<fn(&_, &_) -> bool>,
                ) {
                    self.begin_edit_at(&next, options, columns);
                }
            }
            return;
        }

        if enter && self.edit_session.is_none() {
            if let Some(ref focused) = self.focused_cell.clone() {
                self.begin_edit_at(focused, options, columns);
            }
            return;
        }

        if tab {
            if self.edit_session.is_some() {
                self.commit_edit(options, columns);
            }
            let dir = if shift {
                GridMoveDirection::Left
            } else {
                GridMoveDirection::Right
            };
            if let Some(ref focused) = self.focused_cell.clone() {
                if let Some(next) = find_next_grid_cell(
                    &self.cached_result.visible_rows,
                    columns,
                    &focused.row_id,
                    &focused.column_name,
                    dir,
                    None::<fn(&_, &_) -> bool>,
                ) {
                    self.begin_edit_at(&next, options, columns);
                }
            }
            return;
        }

        if self.edit_session.is_some() {
            return;
        }

        let direction = if up {
            Some(GridMoveDirection::Up)
        } else if down {
            Some(GridMoveDirection::Down)
        } else if left {
            Some(GridMoveDirection::Left)
        } else if right {
            Some(GridMoveDirection::Right)
        } else {
            None
        };

        if let Some(dir) = direction {
            if let Some(ref focused) = self.focused_cell.clone() {
                if let Some(next) = find_next_grid_cell(
                    &self.cached_result.visible_rows,
                    columns,
                    &focused.row_id,
                    &focused.column_name,
                    dir,
                    None::<fn(&_, &_) -> bool>,
                ) {
                    self.focused_cell = Some(next.clone());
                    self.selected_row_ids = vec![next.row_id.clone()];
                    self.last_clicked_row_id = Some(next.row_id.clone());
                }
            }
        }
    }

    fn begin_edit_at(
        &mut self,
        position: &GridCellPosition,
        options: &GridOptions,
        columns: &[GridColumnDef],
    ) {
        let column = columns.iter().find(|c| c.name == position.column_name);
        let is_editable = column
            .is_some_and(|c| c.enable_cell_edit || options.enable_cell_edit);
        if !is_editable {
            self.focused_cell = Some(position.clone());
            self.selected_row_ids = vec![position.row_id.clone()];
            return;
        }

        let current_value = self
            .cached_result
            .visible_rows
            .iter()
            .find(|r| r.id == position.row_id)
            .and_then(|row| column.map(|col| get_cell_value(&row.entity, col)))
            .unwrap_or(Value::Null);

        let session = begin_grid_edit_session(
            &position.row_id,
            &position.column_name,
            stringify_grid_editor_value(&current_value),
        );
        self.focused_cell = Some(position.clone());
        self.selected_row_ids = vec![position.row_id.clone()];
        self.edit_session = Some(session);
    }

    fn commit_edit(&mut self, options: &mut GridOptions, columns: &[GridColumnDef]) {
        let session = match self.edit_session.take() {
            Some(s) => s,
            None => return,
        };

        let column = columns
            .iter()
            .find(|c| c.name == session.editing_cell.column_name);
        let column = match column {
            Some(c) => c,
            None => return,
        };

        let field = column.field.as_deref().unwrap_or(&column.name);

        let old_value = options
            .data
            .iter()
            .find(|r| {
                r.get("id")
                    .and_then(|v| v.as_str())
                    .is_some_and(|id| id == session.editing_cell.row_id)
            })
            .and_then(|r| r.get(field).cloned())
            .unwrap_or(Value::Null);

        let new_value =
            parse_grid_edited_value(column, &session.editing_value, &old_value);

        if new_value != old_value {
            if let Some(row) = options.data.iter_mut().find(|r| {
                r.get("id")
                    .and_then(|v| v.as_str())
                    .is_some_and(|id| id == session.editing_cell.row_id)
            }) {
                if let Some(obj) = row.as_object_mut() {
                    obj.insert(field.to_string(), new_value.clone());
                }
            }

            self.pipeline_dirty = true;
            self.events.push(EguiGridEvent {
                kind: EguiGridEventKind::CellEdited {
                    row_id: session.editing_cell.row_id,
                    column: session.editing_cell.column_name,
                    old_value,
                    new_value,
                },
            });
        }
    }

    fn draw_table(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        display_items: &[DisplayItem],
        theme: &GridTheme,
    ) {
        let show_filters = options.enable_filtering;
        let label_row_h = theme.header_padding_y + 20.0;
        let header_height = if show_filters {
            label_row_h + theme.filter_padding_y + 22.0 + 4.0
        } else {
            label_row_h + theme.header_padding_y
        };

        let mut table = TableBuilder::new(ui)
            .striped(false)
            .resizable(true)
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center));

        for _ in columns {
            table = table.column(Column::initial(176.0).resizable(true).clip(true));
        }

        let has_mixed_heights = display_items
            .iter()
            .any(|item| !matches!(item, DisplayItem::Row(_)));

        table
            .header(header_height, |mut header| {
                for col in columns.iter() {
                    header.col(|ui| {
                        let rect = ui.max_rect();
                        ui.painter().rect_filled(rect, 0.0, theme.header_background);

                        let is_sort_active =
                            self.sort_state.column_name.as_ref() == Some(&col.name)
                                && self.sort_state.direction != SortDirection::None;
                        if is_sort_active {
                            ui.painter()
                                .rect_filled(rect, 0.0, theme.header_sort_active_bg());
                        }

                        // Bottom border
                        let bottom = egui::Rect::from_min_size(
                            egui::pos2(rect.min.x, rect.max.y - 1.0),
                            Vec2::new(rect.width(), 1.0),
                        );
                        ui.painter().rect_filled(bottom, 0.0, theme.border_color);

                        ui.vertical(|ui| {
                            ui.spacing_mut().item_spacing.y = 2.0;
                            ui.add_space(theme.header_padding_y * 0.5);
                            self.draw_header_row(ui, options, col, theme);
                            if show_filters {
                                ui.add_space(2.0);
                                self.draw_filter_input(ui, options, col, theme);
                            }
                        });
                    });
                }
            })
            .body(|body| {
                if has_mixed_heights {
                    let heights = display_items.iter().map(|item| match item {
                        DisplayItem::Group(_) => theme.group_padding_y * 2.0 + 20.0,
                        DisplayItem::Row(_) => theme.row_height,
                        DisplayItem::Expandable(_) => 120.0,
                    });
                    body.heterogeneous_rows(heights, |mut row| {
                        let row_index = row.index();
                        if let Some(item) = display_items.get(row_index) {
                            for col_index in 0..columns.len() {
                                row.col(|ui| {
                                    self.draw_display_item(
                                        ui, options, columns, column_ext,
                                        item, col_index, row_index, theme,
                                    );
                                });
                            }
                        }
                    });
                } else {
                    body.rows(theme.row_height, display_items.len(), |mut row| {
                        let row_index = row.index();
                        if let Some(item) = display_items.get(row_index) {
                            for col_index in 0..columns.len() {
                                row.col(|ui| {
                                    self.draw_display_item(
                                        ui, options, columns, column_ext,
                                        item, col_index, row_index, theme,
                                    );
                                });
                            }
                        }
                    });
                }
            });
    }

    fn refresh_pipeline(&mut self, options: &GridOptions, columns: &[GridColumnDef]) {
        if !self.pipeline_dirty {
            return;
        }

        let grid_options = GridOptions {
            grouping: if options.enable_grouping && !self.group_by_columns.is_empty() {
                Some(GridGroupingOptions {
                    group_by: self.group_by_columns.clone(),
                    start_collapsed: false,
                })
            } else {
                None
            },
            ..options.clone()
        };

        let context = BuildGridPipelineContext {
            options: grid_options,
            columns: columns.to_vec(),
            active_filters: self.active_filters.clone(),
            sort_state: self.sort_state.clone(),
            group_by_columns: self.group_by_columns.clone(),
            collapsed_groups: self.collapsed_groups.clone(),
            expanded_rows: self.expanded_rows.clone(),
            expanded_tree_rows: self.expanded_tree_rows.clone(),
            hidden_row_reasons: BTreeMap::new(),
            current_page: self.current_page,
            page_size: self.page_size,
            row_size: 44,
        };

        self.cached_result = build_grid_pipeline(&context);
        self.pipeline_dirty = false;

        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::RenderingComplete {
                pipeline_ms: self.cached_result.pipeline_ms,
                total_items: self.cached_result.total_items,
            },
        });
    }

    fn draw_header_row(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        column: &GridColumnDef,
        theme: &GridTheme,
    ) {
        ui.horizontal(|ui| {
            ui.add_space(theme.header_padding_x);

            let label = column.display_name.as_deref().unwrap_or(&column.name);
            ui.label(egui::RichText::new(label).color(theme.cell_color).strong());

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(theme.header_padding_x);

                // Group toggle button
                if options.enable_grouping && column.enable_grouping {
                    let is_grouped = self.group_by_columns.contains(&column.name);
                    let group_color = if is_grouped { theme.accent } else { theme.muted_color };
                    let group_response = icon_button(ui, IconKind::Group, group_color);
                    if group_response.clicked() {
                        if is_grouped {
                            self.group_by_columns.retain(|c| c != &column.name);
                        } else {
                            self.group_by_columns.push(column.name.clone());
                        }
                        self.pipeline_dirty = true;
                    }
                    group_response.on_hover_text(if is_grouped {
                        "Ungroup by this column"
                    } else {
                        "Group by this column"
                    });
                }

                // Sort button
                if options.enable_sorting && column.sortable && column.enable_sorting {
                    let is_active =
                        self.sort_state.column_name.as_ref() == Some(&column.name);
                    let (icon, color) = if is_active {
                        match self.sort_state.direction {
                            SortDirection::Asc => (IconKind::SortAsc, theme.accent),
                            SortDirection::Desc => (IconKind::SortDesc, theme.accent),
                            SortDirection::None => (IconKind::SortNone, theme.muted_color),
                        }
                    } else {
                        (IconKind::SortNone, theme.muted_color)
                    };

                    let sort_response = icon_button(ui, icon, color);

                    if sort_response.clicked() {
                        let next_direction = if is_active {
                            match self.sort_state.direction {
                                SortDirection::Asc => SortDirection::Desc,
                                SortDirection::Desc => SortDirection::None,
                                SortDirection::None => SortDirection::Asc,
                            }
                        } else {
                            SortDirection::Asc
                        };

                        self.sort_state = SortState {
                            column_name: if next_direction == SortDirection::None {
                                None
                            } else {
                                Some(column.name.clone())
                            },
                            direction: next_direction,
                        };
                        self.current_page = 1;
                        self.pipeline_dirty = true;

                        self.events.push(EguiGridEvent {
                            kind: EguiGridEventKind::SortChanged {
                                column: column.name.clone(),
                                direction: next_direction,
                            },
                        });
                    }

                    let tooltip = if is_active {
                        match self.sort_state.direction {
                            SortDirection::Asc => "Sorted ascending — click for descending",
                            SortDirection::Desc => "Sorted descending — click to clear",
                            SortDirection::None => "Click to sort ascending",
                        }
                    } else {
                        "Click to sort ascending"
                    };
                    sort_response.on_hover_text(tooltip);
                }
            });
        });
    }

    fn draw_filter_input(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        column: &GridColumnDef,
        theme: &GridTheme,
    ) {
        if !options.enable_filtering || !column.filterable || !column.enable_filtering {
            return;
        }

        ui.horizontal(|ui| {
            ui.add_space(theme.header_padding_x);

            let mut filter_text = self
                .active_filters
                .get(&column.name)
                .cloned()
                .unwrap_or_default();

            let available = ui.available_width() - theme.header_padding_x * 2.0;
            let response = egui::TextEdit::singleline(&mut filter_text)
                .hint_text("Filter...")
                .desired_width(available.max(40.0))
                .text_color(theme.cell_color)
                .show(ui)
                .response;

            if response.changed() {
                if filter_text.is_empty() {
                    self.active_filters.remove(&column.name);
                } else {
                    self.active_filters
                        .insert(column.name.clone(), filter_text.clone());
                }
                self.current_page = 1;
                self.pipeline_dirty = true;

                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::FilterChanged {
                        column: column.name.clone(),
                        term: filter_text,
                    },
                });
            }
        });
    }

    fn draw_display_item(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        item: &DisplayItem,
        col_index: usize,
        row_index: usize,
        theme: &GridTheme,
    ) {
        match item {
            DisplayItem::Group(group) => {
                self.draw_group_row(ui, options, columns, theme, group, col_index);
            }
            DisplayItem::Row(row_item) => {
                self.draw_data_row(
                    ui, options, columns, column_ext, row_item, col_index, row_index, theme,
                );
            }
            DisplayItem::Expandable(expandable) => {
                let rect = ui.max_rect();
                ui.painter()
                    .rect_filled(rect, 0.0, theme.expandable_bg());

                let bottom = egui::Rect::from_min_size(
                    egui::pos2(rect.min.x, rect.max.y - 1.0),
                    Vec2::new(rect.width(), 1.0),
                );
                ui.painter()
                    .rect_filled(bottom, 0.0, theme.border_color);

                if col_index == 0 {
                    ui.add_space(theme.cell_padding_x);
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new("Detail View")
                                .strong()
                                .size(13.0)
                                .color(theme.accent),
                        );
                        for col in columns {
                            let value =
                                format_grid_cell_display_value(&expandable.row, col);
                            let label = col.display_name.as_deref().unwrap_or(&col.name);
                            ui.label(
                                egui::RichText::new(format!("{}: {}", label, value))
                                    .color(theme.cell_color),
                            );
                        }
                    });
                }
            }
        }
    }

    fn draw_group_row(
        &mut self,
        ui: &mut Ui,
        _options: &GridOptions,
        _columns: &[GridColumnDef],
        theme: &GridTheme,
        group: &ui_grid_core::models::GroupItem,
        col_index: usize,
    ) {
        let rect = ui.max_rect();
        ui.painter()
            .rect_filled(rect, 0.0, theme.group_background);

        let bottom = egui::Rect::from_min_size(
            egui::pos2(rect.min.x, rect.max.y - 1.0),
            Vec2::new(rect.width(), 1.0),
        );
        ui.painter()
            .rect_filled(bottom, 0.0, theme.border_color);

        if col_index == 0 {
            let indent =
                group.depth as f32 * theme.group_indent_per_depth + theme.cell_padding_x;
            ui.add_space(indent);

            let expand_icon = if group.collapsed {
                IconKind::ExpandRight
            } else {
                IconKind::ExpandDown
            };
            let tri_response = icon_button(ui, expand_icon, theme.cell_color);

            let label = format!("{}: {} ({})", group.field, group.label, group.count);
            let rich = egui::RichText::new(&label)
                .color(theme.cell_color)
                .strong();
            let text_response = ui.add(egui::Label::new(rich).sense(egui::Sense::click()));
            let response = tri_response | text_response;
            if response.clicked() {
                let collapsed = !group.collapsed;
                self.collapsed_groups.insert(group.id.clone(), collapsed);
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::GroupToggled {
                        group_id: group.id.clone(),
                        collapsed,
                    },
                });
            }
        }
    }

    fn draw_data_row(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        row_item: &RowItem,
        col_index: usize,
        row_index: usize,
        theme: &GridTheme,
    ) {
        if col_index >= columns.len() {
            return;
        }
        let column = &columns[col_index];

        let rect = ui.max_rect();

        let is_selected = self.selected_row_ids.contains(&row_item.row.id);
        let bg = if is_selected {
            theme.accent_tint(30)
        } else if row_index % 2 == 0 {
            theme.row_even
        } else {
            theme.row_odd
        };
        ui.painter().rect_filled(rect, 0.0, bg);

        let bottom = egui::Rect::from_min_size(
            egui::pos2(rect.min.x, rect.max.y - 1.0),
            Vec2::new(rect.width(), 1.0),
        );
        ui.painter()
            .rect_filled(bottom, 0.0, theme.border_color);

        // Hover highlight (paint before content so content draws on top)
        let pointer_hovering = ui.input(|i| {
            i.pointer.hover_pos().is_some_and(|pos| rect.contains(pos))
        });
        if !is_selected && pointer_hovering {
            ui.painter().rect_filled(rect, 0.0, theme.row_hover);
        }

        let is_focused = self.focused_cell.as_ref().is_some_and(|f| {
            f.row_id == row_item.row.id && f.column_name == column.name
        });

        if is_focused {
            ui.painter().rect_stroke(
                rect.shrink(1.0),
                0.0,
                egui::Stroke::new(2.0, theme.accent),
                egui::StrokeKind::Inside,
            );
        }

        // Render cell content
        ui.add_space(theme.cell_padding_x);

        if col_index == 0 {
            self.draw_row_leading_controls(ui, options, row_item, theme);
        }

        let is_editing = self.edit_session.as_ref().is_some_and(|s| {
            s.editing_cell.row_id == row_item.row.id
                && s.editing_cell.column_name == column.name
        });

        if is_editing {
            self.draw_cell_editor(ui, column, column_ext, theme);
        } else {
            self.draw_formatted_cell(ui, column, column_ext, row_item, row_index, theme);
        }

        // Skip the click overlay when this cell is being edited so editor
        // widgets (date picker button, etc.) can receive clicks directly.
        if !is_editing {
            let response = ui.interact(
                rect,
                ui.id().with(("row_cell", row_index, col_index)),
                egui::Sense::click(),
            );

            if response.clicked() {
                // Commit any in-progress edit on a different cell
                if self.edit_session.is_some() {
                    self.commit_edit(options, columns);
                }

                let shift = ui.input(|i| i.modifiers.shift);
                self.handle_row_click(&row_item.row.id, shift);

                self.focused_cell = Some(GridCellPosition {
                    row_id: row_item.row.id.clone(),
                    column_name: column.name.clone(),
                });
            }

            if response.double_clicked() {
                // Commit any in-progress edit on a different cell
                if self.edit_session.is_some() {
                    self.commit_edit(options, columns);
                }

                let is_editable =
                    column.enable_cell_edit || options.enable_cell_edit;
                if is_editable {
                    self.focused_cell = Some(GridCellPosition {
                        row_id: row_item.row.id.clone(),
                        column_name: column.name.clone(),
                    });
                    let current_value = get_cell_value(&row_item.row.entity, column);
                    let session = begin_grid_edit_session(
                        &row_item.row.id,
                        &column.name,
                        stringify_grid_editor_value(&current_value),
                    );
                    self.edit_session = Some(session);
                }
            }
        }
    }

    fn draw_row_leading_controls(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        row_item: &RowItem,
        theme: &GridTheme,
    ) {
        if options.enable_tree_view && row_item.row.tree_level > 0 {
            let indent = row_item.row.tree_level as f32 * theme.tree_indent_per_level;
            ui.add_space(indent);
        }

        if options.enable_tree_view && row_item.row.has_children {
            let expanded = self
                .expanded_tree_rows
                .get(&row_item.row.id)
                .copied()
                .unwrap_or(false);
            let icon = if expanded { IconKind::ExpandDown } else { IconKind::ExpandRight };
            if icon_button(ui, icon, theme.accent).clicked() {
                let next = !expanded;
                self.expanded_tree_rows
                    .insert(row_item.row.id.clone(), next);
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::TreeNodeToggled {
                        row_id: row_item.row.id.clone(),
                        expanded: next,
                    },
                });
            }
        } else if options.enable_tree_view {
            ui.add_space(16.0);
        }

        if options.enable_expandable && !options.enable_tree_view {
            let expanded = self
                .expanded_rows
                .get(&row_item.row.id)
                .copied()
                .unwrap_or(false);
            let icon = if expanded { IconKind::ExpandDown } else { IconKind::ExpandRight };
            if icon_button(ui, icon, theme.accent).clicked() {
                let next = !expanded;
                self.expanded_rows.insert(row_item.row.id.clone(), next);
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::RowExpanded {
                        row_id: row_item.row.id.clone(),
                        expanded: next,
                    },
                });
            }
        }
    }

    fn draw_formatted_cell(
        &self,
        ui: &mut Ui,
        column: &GridColumnDef,
        column_ext: &[EguiColumnExt],
        row_item: &RowItem,
        row_index: usize,
        theme: &GridTheme,
    ) {
        let value = get_cell_value(&row_item.row.entity, column);

        if let Some(ext) = find_column_ext(column_ext, &column.name) {
            if let Some(ref renderer) = ext.cell_renderer {
                let ctx = GridCellContext {
                    value: &value,
                    row: &row_item.row,
                    column,
                    theme,
                    row_index,
                };
                renderer(ui, &ctx);
                return;
            }

            if let Some(ref formatter) = ext.formatter {
                let text = formatter(&value, &row_item.row);
                ui.label(egui::RichText::new(&text).color(theme.cell_color));
                return;
            }
        }

        let text = format_grid_cell_display_value(&row_item.row, column);
        ui.label(egui::RichText::new(&text).color(theme.cell_color));
    }

    fn draw_cell_editor(
        &mut self,
        ui: &mut Ui,
        column: &GridColumnDef,
        column_ext: &mut [EguiColumnExt],
        theme: &GridTheme,
    ) {
        if let Some(ref mut session) = self.edit_session {
            if let Some(ext) = find_column_ext_mut(column_ext, &column.name) {
                if let Some(ref mut editor) = ext.cell_editor {
                    editor(ui, &mut session.editing_value, theme);
                    return;
                }
            }

            let response = egui::TextEdit::singleline(&mut session.editing_value)
                .desired_width(ui.available_width() - theme.cell_padding_x * 2.0)
                .text_color(theme.cell_color)
                .show(ui)
                .response;
            response.request_focus();
        }
    }

    fn handle_row_click(&mut self, row_id: &str, shift: bool) {
        if shift {
            if let Some(ref last) = self.last_clicked_row_id {
                let rows = &self.cached_result.visible_rows;
                let start = rows.iter().position(|r| r.id == *last);
                let end = rows.iter().position(|r| r.id == row_id);
                if let (Some(s), Some(e)) = (start, end) {
                    let (from, to) = if s <= e { (s, e) } else { (e, s) };
                    self.selected_row_ids = rows[from..=to]
                        .iter()
                        .map(|r| r.id.clone())
                        .collect();
                    self.events.push(EguiGridEvent {
                        kind: EguiGridEventKind::SelectionChanged {
                            selected_ids: self.selected_row_ids.clone(),
                        },
                    });
                    return;
                }
            }
        }

        if self.selected_row_ids.contains(&row_id.to_string()) {
            self.selected_row_ids.retain(|id| id != row_id);
        } else {
            self.selected_row_ids = vec![row_id.to_string()];
        }
        self.last_clicked_row_id = Some(row_id.to_string());

        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::SelectionChanged {
                selected_ids: self.selected_row_ids.clone(),
            },
        });
    }

    fn draw_pagination(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        total_items: usize,
        theme: &GridTheme,
    ) {
        let rect = ui.max_rect();
        ui.painter()
            .rect_filled(rect, 0.0, theme.header_background);

        let top = egui::Rect::from_min_size(rect.min, Vec2::new(rect.width(), 1.0));
        ui.painter().rect_filled(top, 0.0, theme.border_color);

        let total_pages = get_total_pages_value(options, total_items, self.page_size);

        ui.horizontal(|ui| {
            ui.add_space(theme.cell_padding_x);

            let btn = |ui: &mut Ui, text: &str| -> egui::Response {
                ui.add(
                    egui::Label::new(egui::RichText::new(text).color(theme.accent))
                        .sense(egui::Sense::click()),
                )
            };

            if btn(ui, "\u{00AB} First").clicked() && self.current_page > 1 {
                self.current_page = 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged { page: 1 },
                });
            }
            if btn(ui, "\u{2039} Prev").clicked() && self.current_page > 1 {
                self.current_page -= 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }

            ui.label(
                egui::RichText::new(format!("Page {} / {}", self.current_page, total_pages))
                    .color(theme.cell_color),
            );

            if btn(ui, "Next \u{203A}").clicked() && self.current_page < total_pages {
                self.current_page += 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }
            if btn(ui, "Last \u{00BB}").clicked() && self.current_page < total_pages {
                self.current_page = total_pages;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }

            ui.separator();
            ui.label(egui::RichText::new("Rows/page:").color(theme.muted_color));
            let prev_size = self.page_size;
            egui::ComboBox::from_id_salt(ui.id().with("page_size"))
                .selected_text(
                    egui::RichText::new(self.page_size.to_string()).color(theme.cell_color),
                )
                .show_ui(ui, |ui| {
                    for &size in &[5, 10, 25, 50, 100] {
                        ui.selectable_value(&mut self.page_size, size, size.to_string());
                    }
                });
            if self.page_size != prev_size {
                self.current_page = 1;
                self.pipeline_dirty = true;
            }

            ui.separator();
            ui.label(
                egui::RichText::new(format!("Total: {} rows", total_items))
                    .color(theme.muted_color),
            );
        });
    }
}
