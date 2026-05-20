#![allow(dead_code)]

use std::collections::BTreeMap;
use std::sync::Arc;

use egui::{Color32, Key, Pos2, Response, Ui, Vec2, WidgetInfo, WidgetType};
use egui_extras::{Column, TableBuilder};
use serde_json::Value;
use ui_grid_core::{
    constants::SortDirection,
    display::format_grid_cell_display_value,
    edit::{
        GridEditSession, GridMoveDirection, begin_grid_edit_session, find_next_grid_cell,
        parse_grid_edited_value, stringify_grid_editor_value,
    },
    export::{
        GridExportContext, GridExportPayload, build_csv_export_payload, build_grid_export_context,
        header_label,
    },
    exporter_registry::{
        GridExportResult, GridExportScope, GridExporter, GridRegisteredExportContext,
        UnknownExportFormat, register_grid_exporter, unregister_grid_exporter,
    },
    models::{
        BuildGridPipelineContext, DisplayItem, GridCellPosition, GridColumnDef,
        GridGroupingOptions, GridIcon, GridOptions, GridRow, PipelineResult, RowItem, SortState,
    },
    pagination::{get_first_row_index_value, get_last_row_index_value, get_total_pages_value},
    pinning::{
        PinDirection, PinnedColumnState, build_initial_pinned_state, get_column_pin_direction,
        is_column_pinnable, pin_column_state,
    },
    pipeline::build_grid_pipeline,
    state::{
        BuildGridSavedStateContext, create_grid_restore_mutation_plan,
        deserialize_grid_saved_state, deserialize_grid_saved_state_with,
        serialize_grid_saved_state, serialize_grid_saved_state_with,
    },
    utils::get_cell_value,
    validate::{get_grid_cell_error_messages, is_grid_cell_invalid, run_grid_cell_validators},
    viewmodel::{
        can_grid_move_columns, grid_expand_toggle_label_for_row, grid_filter_placeholder,
        grid_group_disclosure_icon, grid_group_disclosure_label, grid_grouping_button_icon,
        grid_grouping_button_label, grid_pin_left_icon, grid_pin_right_icon, grid_sort_button_icon,
        grid_sort_button_label, grid_tree_toggle_icon, grid_tree_toggle_label_for_row,
        grid_unpin_icon, is_grid_column_grouped,
    },
};

use crate::column_ext::{
    EguiColumnExt, EguiHeaderAction, GridCellContext, GridFilterContext, GridHeaderControlsContext,
    find_column_ext, find_column_ext_mut,
};
use crate::grid_theme::GridTheme;

fn paint_triangle(painter: &egui::Painter, center: Pos2, half: f32, dir: TriDir, color: Color32) {
    let points = match dir {
        TriDir::Left => vec![
            Pos2::new(center.x + half * 0.5, center.y - half),
            Pos2::new(center.x - half * 0.7, center.y),
            Pos2::new(center.x + half * 0.5, center.y + half),
        ],
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
    painter.add(egui::Shape::convex_polygon(
        points,
        color,
        egui::Stroke::NONE,
    ));
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use ui_grid_core::models::{
        GridColumnDef, GridColumnType, GridOptions, GridRow, GridSavedState,
    };

    use super::EguiGrid;
    use ui_grid_core::pinning::PinDirection;

    fn test_columns() -> Vec<GridColumnDef> {
        vec![
            GridColumnDef {
                name: "owner".to_string(),
                display_name: Some("Owner".to_string()),
                field: Some("owner".to_string()),
                r#type: GridColumnType::String,
                ..GridColumnDef::default()
            },
            GridColumnDef {
                name: "status".to_string(),
                display_name: Some("Status".to_string()),
                field: Some("status".to_string()),
                r#type: GridColumnType::String,
                ..GridColumnDef::default()
            },
        ]
    }

    fn test_options() -> GridOptions {
        GridOptions {
            id: "desk-grid/spec".to_string(),
            column_defs: test_columns(),
            data: vec![json!({"id": "row-1", "owner": "Alicia", "status": "Activo"})],
            enable_pinning: true,
            enable_column_moving: true,
            ..GridOptions::default()
        }
    }

    fn test_row() -> GridRow {
        GridRow::new(
            "row-1".to_string(),
            json!({"id": "row-1", "owner": "Alicia", "status": "Activo"}),
            0,
            44,
        )
    }

    #[test]
    fn egui_grid_exports_visible_rows_without_io() {
        let options = test_options();
        let columns = test_columns();
        let mut grid = EguiGrid::new();
        grid.cached_result.visible_rows = vec![test_row()];

        let payload = grid.export_csv(&options, &columns);
        assert_eq!(payload.filename, "desk-grid_spec.csv");
        assert!(payload.contents.contains("Owner,Status"));
        assert!(payload.contents.contains("Alicia,Activo"));

        let custom = grid.export_with(&options, &columns, |context| {
            context
                .rows
                .iter()
                .map(|row| row.id.clone())
                .collect::<Vec<_>>()
                .join("|")
        });
        assert_eq!(custom, "row-1");
    }

    #[test]
    fn egui_grid_save_and_restore_state_are_storage_agnostic() {
        let mut grid = EguiGrid::new();
        grid.column_order = vec!["status".to_string(), "owner".to_string()];
        grid.active_filters
            .insert("owner".to_string(), "Ali*".to_string());
        grid.group_by_columns = vec!["status".to_string()];
        grid.current_page = 3;
        grid.page_size = 25;
        grid.expanded_rows.insert("row-1".to_string(), true);
        grid.expanded_tree_rows.insert("tree-1".to_string(), true);
        grid.pinned_columns
            .insert("owner".to_string(), "left".to_string());
        grid.cached_result.total_items = 80;

        let saved = grid.save_state();
        let json = grid.serialize_state().expect("serialize state");
        let custom = grid.serialize_state_with(|state| state.column_order.join("|"));
        assert_eq!(custom, "status|owner");

        let mut restored = EguiGrid::new();
        restored.restore_state(&saved);
        assert_eq!(restored.column_order(), ["status", "owner"]);
        assert_eq!(restored.group_by_columns(), ["status"]);
        assert_eq!(
            restored.pinned_columns().get("owner"),
            Some(&"left".to_string())
        );

        let mut restored_from_json = EguiGrid::new();
        restored_from_json
            .deserialize_state(&json)
            .expect("restore json state");
        assert_eq!(restored_from_json.column_order(), ["status", "owner"]);
        assert_eq!(
            restored_from_json.pinned_columns().get("owner"),
            Some(&"left".to_string())
        );

        let mut restored_custom = EguiGrid::new();
        restored_custom
            .deserialize_state_with("status|owner", |value| {
                Ok::<GridSavedState, &'static str>(GridSavedState {
                    column_order: value.split('|').map(str::to_string).collect(),
                    ..GridSavedState::default()
                })
            })
            .expect("restore custom state");
        assert_eq!(restored_custom.column_order(), ["status", "owner"]);
    }

    #[test]
    fn egui_grid_supports_programmatic_pinning_and_reorder() {
        let mut grid = EguiGrid::new();
        grid.column_order = vec!["owner".to_string(), "status".to_string()];

        grid.pin_column("owner", PinDirection::Left);
        assert_eq!(
            grid.pinned_columns().get("owner"),
            Some(&"left".to_string())
        );

        grid.move_column_before("status", "owner");
        assert_eq!(grid.column_order(), ["status", "owner"]);
    }

    #[test]
    fn egui_grid_restore_normalizes_unsafe_state() {
        let mut grid = EguiGrid::new();
        grid.restore_state(&GridSavedState {
            column_order: vec!["owner".to_string(), "__proto__".to_string()],
            filters: std::collections::BTreeMap::from([
                ("owner".to_string(), "Ali*".to_string()),
                ("constructor".to_string(), "bad".to_string()),
            ]),
            sort: None,
            grouping: vec!["status".to_string(), "prototype".to_string()],
            pagination: None,
            expandable: Default::default(),
            tree_view: Default::default(),
            pinning: std::collections::BTreeMap::from([
                ("owner".to_string(), "left".to_string()),
                ("prototype".to_string(), "right".to_string()),
            ]),
            column_width_overrides: Default::default(),
        });

        assert_eq!(grid.column_order(), ["owner"]);
        assert_eq!(grid.group_by_columns(), ["status"]);
        assert_eq!(
            grid.pinned_columns().get("owner"),
            Some(&"left".to_string())
        );
        assert!(!grid.pinned_columns().contains_key("prototype"));
    }
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

fn paint_pin_icon(
    painter: &egui::Painter,
    center: Pos2,
    half: f32,
    color: Color32,
    side: PinDirection,
) {
    let stem_top = Pos2::new(center.x, center.y - half * 0.8);
    let stem_bottom = Pos2::new(center.x, center.y + half * 0.9);
    painter.line_segment([stem_top, stem_bottom], egui::Stroke::new(1.5, color));
    let head = [
        Pos2::new(center.x - half * 0.7, center.y - half * 0.25),
        Pos2::new(center.x + half * 0.7, center.y - half * 0.25),
        Pos2::new(center.x, center.y + half * 0.25),
    ];
    painter.add(egui::Shape::convex_polygon(
        head.to_vec(),
        color,
        egui::Stroke::NONE,
    ));

    let guide_x = match side {
        PinDirection::Left => center.x - half * 1.35,
        PinDirection::Right => center.x + half * 1.35,
        PinDirection::None => center.x,
    };
    painter.line_segment(
        [
            Pos2::new(guide_x, center.y - half),
            Pos2::new(guide_x, center.y + half),
        ],
        egui::Stroke::new(1.5, color),
    );
}

fn paint_unpin_icon(painter: &egui::Painter, center: Pos2, half: f32, color: Color32) {
    paint_pin_icon(painter, center, half, color, PinDirection::Left);
    painter.line_segment(
        [
            Pos2::new(center.x - half, center.y + half),
            Pos2::new(center.x + half, center.y - half),
        ],
        egui::Stroke::new(1.5, color),
    );
}

fn paint_sort_icon(painter: &egui::Painter, center: Pos2, half: f32, color: Color32) {
    paint_triangle(
        painter,
        Pos2::new(center.x, center.y - half * 0.4),
        half * 0.55,
        TriDir::Up,
        color,
    );
    paint_triangle(
        painter,
        Pos2::new(center.x, center.y + half * 0.45),
        half * 0.55,
        TriDir::Down,
        color,
    );
}

fn paint_semantic_icon(painter: &egui::Painter, rect: egui::Rect, icon: &GridIcon, color: Color32) {
    let c = rect.center();
    let h = 5.0;
    match icon {
        GridIcon::Grip => paint_hamburger(painter, c, h, color),
        GridIcon::Sort => paint_sort_icon(painter, c, h, color),
        GridIcon::SortAsc => paint_triangle(painter, c, h, TriDir::Up, color),
        GridIcon::SortDesc => paint_triangle(painter, c, h, TriDir::Down, color),
        GridIcon::Group => paint_grid_icon(painter, c, h, color),
        GridIcon::Ungroup => {
            paint_grid_icon(painter, c, h, color);
            painter.line_segment(
                [Pos2::new(c.x - h, c.y + h), Pos2::new(c.x + h, c.y - h)],
                egui::Stroke::new(1.5, color),
            );
        }
        GridIcon::ChevronLeft => paint_triangle(painter, c, h * 0.8, TriDir::Left, color),
        GridIcon::ChevronRight => paint_triangle(painter, c, h * 0.8, TriDir::Right, color),
        GridIcon::ChevronDown => paint_triangle(painter, c, h * 0.8, TriDir::Down, color),
        GridIcon::PinLeft => paint_pin_icon(painter, c, h, color, PinDirection::Left),
        GridIcon::PinRight => paint_pin_icon(painter, c, h, color, PinDirection::Right),
        GridIcon::Unpin => paint_unpin_icon(painter, c, h, color),
    }
}

fn icon_button(
    ui: &mut Ui,
    icon: &GridIcon,
    theme: &GridTheme,
    color: Color32,
    active: bool,
) -> egui::Response {
    let size = Vec2::splat(16.0);
    let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());
    if ui.is_rect_visible(rect) {
        let background = if active {
            Some(theme.control_active_background)
        } else if response.hovered() {
            Some(theme.control_hover_background)
        } else {
            None
        };
        if let Some(background) = background {
            ui.painter().rect_filled(rect.expand(2.0), 4.0, background);
        }
        paint_semantic_icon(ui.painter(), rect, icon, color);
    }
    response
}

fn icon_button_labeled(
    ui: &mut Ui,
    icon: &GridIcon,
    theme: &GridTheme,
    color: Color32,
    label: &str,
    active: bool,
) -> Response {
    let response = icon_button(ui, icon, theme, color, active);
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, ui.is_enabled(), label));
    response.on_hover_text(label)
}

/// Paint an expand/collapse icon without registering interaction.
/// Returns the allocated rect (with padding) so the caller can do hit-testing.
fn expand_icon_passive(ui: &mut Ui, icon: &GridIcon, color: Color32) -> egui::Rect {
    let size = Vec2::new(24.0, 24.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    if ui.is_rect_visible(rect) {
        paint_semantic_icon(ui.painter(), rect, icon, color);
    }
    rect
}

enum TriDir {
    Left,
    Right,
    Down,
    Up,
}

struct HeaderRowLayout {
    label_id: egui::Id,
    controls_left_x: f32,
}

#[derive(Debug, Clone)]
pub struct EguiGridEvent {
    pub kind: EguiGridEventKind,
}

/// Modifier keys held during a row click. The grid widget reads these
/// off `egui::InputState::modifiers` and translates them into selection
/// semantics (range-extend on Shift, additive toggle on Cmd/Ctrl).
#[derive(Debug, Clone, Copy, Default)]
struct RowClickModifiers {
    shift: bool,
    /// `true` when Cmd is held on Mac or Ctrl on other platforms — egui
    /// abstracts both as `modifiers.command`.
    toggle: bool,
}

/// Context passed to a custom group-row renderer registered via
/// [`EguiGrid::with_group_row_renderer`]. The renderer paints the
/// entire group row in place of the default implementation.
pub struct GridGroupRowContext<'a> {
    pub group: &'a ui_grid_core::models::GroupItem,
    pub options: &'a GridOptions,
    pub columns: &'a [GridColumnDef],
    pub theme: &'a GridTheme,
    /// `true` when the group is currently collapsed. Mirrors the
    /// `collapsed` flag the default renderer reads to flip the
    /// disclosure triangle.
    pub collapsed: bool,
}

/// Action returned from a group-row renderer. The default renderer
/// returns `Toggle` when the disclosure chevron is clicked; consumer
/// renderers signal the same intent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum GridGroupRowAction {
    #[default]
    None,
    Toggle,
}

/// Context passed to a custom expandable-row renderer registered via
/// [`EguiGrid::with_expandable_row_renderer`]. The renderer paints
/// the entire detail row.
pub struct GridExpandableRowContext<'a> {
    pub row: &'a ui_grid_core::models::GridRow,
    pub options: &'a GridOptions,
    pub columns: &'a [GridColumnDef],
    pub theme: &'a GridTheme,
}

/// Context passed to a custom empty-state renderer registered via
/// [`EguiGrid::with_empty_state_renderer`]. Painted when the
/// pipeline produces no display items.
pub struct GridEmptyStateContext<'a> {
    pub options: &'a GridOptions,
    pub theme: &'a GridTheme,
}

type GroupRowRenderer = Box<dyn FnMut(&mut Ui, &GridGroupRowContext<'_>) -> GridGroupRowAction>;
type ExpandableRowRenderer = Box<dyn FnMut(&mut Ui, &GridExpandableRowContext<'_>)>;
type EmptyStateRenderer = Box<dyn FnMut(&mut Ui, &GridEmptyStateContext<'_>)>;

/// Synthetic column the grid prepends to render the row-selection
/// checkbox. Mirrors the TS `selectionRowHeaderCol` sentinel — the
/// same name is used by `viewmodel::is_grid_primary_column` and the
/// CSV exporter to skip the synthetic column.
pub const SELECTION_ROW_HEADER_COL_NAME: &str = "selectionRowHeaderCol";

/// Width (in egui logical pixels) of the synthetic checkbox column.
/// Matches the default the TS host renders when
/// `selectionRowHeaderWidth` is unset.
const SELECTION_ROW_HEADER_COL_WIDTH: f32 = 30.0;

/// Build the synthetic checkbox column. The column is marked pinned-left
/// so it stays anchored to the leading edge regardless of user pin
/// state. Sort / filter / group / pin chrome is suppressed.
fn build_selection_row_header_column() -> GridColumnDef {
    GridColumnDef {
        name: SELECTION_ROW_HEADER_COL_NAME.to_string(),
        display_name: Some(String::new()),
        sortable: false,
        filterable: false,
        enable_sorting: false,
        enable_filtering: false,
        enable_grouping: false,
        enable_pinning: false,
        pinned_left: true,
        ..GridColumnDef::default()
    }
}

/// True when the grid options enable both row selection and the
/// row-header (checkbox) chrome. The TS contract is that
/// `enable_row_header_selection` defaults to `true`, so a host that
/// merely sets `enable_row_selection` opts in to the chrome.
fn should_show_selection_row_header(options: &GridOptions) -> bool {
    options.enable_row_selection.unwrap_or(false)
        && options.enable_row_header_selection.unwrap_or(true)
}

#[derive(Debug, Clone)]
pub enum EguiGridEventKind {
    SortChanged {
        column: String,
        direction: SortDirection,
    },
    FilterChanged {
        column: String,
        term: String,
    },
    PageChanged {
        page: usize,
    },
    GroupToggled {
        group_id: String,
        collapsed: bool,
    },
    RowExpanded {
        row_id: String,
        expanded: bool,
    },
    TreeNodeToggled {
        row_id: String,
        expanded: bool,
    },
    CellEdited {
        row_id: String,
        column: String,
        old_value: Value,
        new_value: Value,
    },
    SelectionChanged {
        selected_ids: Vec<String>,
    },
    /// Multi-row selection delta. Emitted when more than one row's
    /// selection state changed in a single interaction (Shift-click
    /// range, drag-paint, Ctrl+A select-all). Mirrors the TS
    /// `rowSelectionChangedBatch` event gated by
    /// `options.enableSelectionBatchEvent` (default `true`). Single-row
    /// changes still fire `SelectionChanged` as before.
    SelectionChangedBatch {
        selected_ids: Vec<String>,
    },
    ColumnPinned {
        column: String,
        direction: PinDirection,
    },
    ColumnsReordered {
        order: Vec<String>,
    },
    RenderingComplete {
        pipeline_ms: f64,
        total_items: usize,
    },
    /// Emitted when the body scroll position is within
    /// `options.infinite_scroll_rows_from_end` rows of the bottom.
    /// Mirrors the TS `needLoadMoreData` event consumers wire up to
    /// append the next page of data. Hosts that don't enable
    /// `enable_infinite_scroll` never see this event.
    NeedLoadMoreData,
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
    /// Drag-paint multi-row selection anchor. Set on the row where the
    /// pointer was first pressed; cleared on release. Mirrors the TS
    /// vanilla `mousedown` → `mousemove` → `mouseup` selection drag.
    drag_paint_anchor: Option<String>,
    /// Validator registry used to resolve consumer-registered error
    /// messages. Built lazily from `options.labels` on first paint and
    /// kept around so message-template lookups don't allocate per
    /// invalid-cell tooltip.
    validator_registry: ui_grid_core::validate::GridValidatorRegistry,
    /// Row-edit lifecycle state (dirty / saving / error sets). Lives
    /// on the grid because the pipeline rebuild resets the per-row
    /// flags every pass; we re-apply them after each rebuild from
    /// this state. Hosts mutate it via `mark_row_dirty` /
    /// `mark_row_saving` / `mark_row_clean` / `mark_row_error`.
    row_edit_state: ui_grid_core::row_edit::GridRowEditState,
    /// Per-column width overrides — populated by the auto-fit
    /// dblclick handler and any future drag-resize wiring. Mirrors
    /// the TS `columnWidthOverrides` map so save / restore round-trips
    /// preserve the user's resize state.
    column_widths: BTreeMap<String, String>,
    /// Last `total_rows` value at which `NeedLoadMoreData` was
    /// emitted. Tracking this prevents the event from re-firing on
    /// every paint while the viewport hovers near the bottom; the
    /// host emits, the host appends, the row count grows, the next
    /// near-bottom paint re-emits.
    last_load_more_total_rows: Option<usize>,
    column_order: Vec<String>,
    pinned_columns: PinnedColumnState,
    dragged_column: Option<String>,
    pinned_scroll_offset_y: f32,
    group_row_renderer: Option<GroupRowRenderer>,
    expandable_row_renderer: Option<ExpandableRowRenderer>,
    empty_state_renderer: Option<EmptyStateRenderer>,
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
            drag_paint_anchor: None,
            validator_registry: ui_grid_core::validate::create_grid_validator_registry(
                &ui_grid_core::models::GridLabels::default(),
            ),
            row_edit_state: ui_grid_core::row_edit::create_grid_row_edit_state(),
            column_widths: BTreeMap::new(),
            last_load_more_total_rows: None,
            column_order: Vec::new(),
            pinned_columns: PinnedColumnState::new(),
            dragged_column: None,
            pinned_scroll_offset_y: 0.0,
            group_row_renderer: None,
            expandable_row_renderer: None,
            empty_state_renderer: None,
        }
    }

    /// Replace the default group-row renderer. The closure paints the
    /// entire row and returns a [`GridGroupRowAction`] indicating
    /// whether to toggle the group's collapsed state.
    pub fn with_group_row_renderer(
        mut self,
        renderer: impl FnMut(&mut Ui, &GridGroupRowContext<'_>) -> GridGroupRowAction + 'static,
    ) -> Self {
        self.group_row_renderer = Some(Box::new(renderer));
        self
    }

    /// Replace the default expandable detail-row renderer. The closure
    /// paints the entire detail row.
    pub fn with_expandable_row_renderer(
        mut self,
        renderer: impl FnMut(&mut Ui, &GridExpandableRowContext<'_>) + 'static,
    ) -> Self {
        self.expandable_row_renderer = Some(Box::new(renderer));
        self
    }

    /// Replace the default empty-state renderer. Painted when the
    /// pipeline produces no display items (no rows, all filtered out).
    pub fn with_empty_state_renderer(
        mut self,
        renderer: impl FnMut(&mut Ui, &GridEmptyStateContext<'_>) + 'static,
    ) -> Self {
        self.empty_state_renderer = Some(Box::new(renderer));
        self
    }

    pub fn result(&self) -> &PipelineResult {
        &self.cached_result
    }

    /// Read the current selection as a slice of row ids. Useful for
    /// hosts that want to display a count or apply bulk operations
    /// without subscribing to every `SelectionChanged` event.
    pub fn selected_row_ids(&self) -> &[String] {
        &self.selected_row_ids
    }

    /// Read the row-edit lifecycle state. Hosts that want to display
    /// a count of pending changes / errors can read this directly.
    pub fn row_edit_state(&self) -> &ui_grid_core::row_edit::GridRowEditState {
        &self.row_edit_state
    }

    /// Move a row to the dirty state. Mirrors TS
    /// `gridApi.rowEdit.setRowsDirty([rowEntity])` for a single row.
    pub fn mark_row_dirty(&mut self, row_id: impl Into<String>) {
        let id = row_id.into();
        self.row_edit_state.dirty_row_ids.insert(id.clone());
        self.row_edit_state.error_row_ids.remove(&id);
        self.row_edit_state.saving_row_ids.remove(&id);
        self.pipeline_dirty = true;
    }

    /// Move a row to the saving state. Mirrors TS
    /// `gridApi.rowEdit.flushDirtyRows()` per-row transition.
    pub fn mark_row_saving(&mut self, row_id: impl Into<String>) {
        let id = row_id.into();
        self.row_edit_state.saving_row_ids.insert(id.clone());
        self.row_edit_state.error_row_ids.remove(&id);
        self.pipeline_dirty = true;
    }

    /// Move a row to the clean state — drops it from every lifecycle
    /// set so the dirty / saving / error tints clear on the next
    /// pipeline pass. Mirrors TS `setSavePromise(promise.then(clean))`.
    pub fn mark_row_clean(&mut self, row_id: &str) {
        self.row_edit_state.dirty_row_ids.remove(row_id);
        self.row_edit_state.saving_row_ids.remove(row_id);
        self.row_edit_state.error_row_ids.remove(row_id);
        self.row_edit_state.save_promise_row_ids.remove(row_id);
        self.pipeline_dirty = true;
    }

    /// Move a row to the error state. Mirrors TS save-failure path:
    /// the row stays dirty so the user can retry.
    pub fn mark_row_error(&mut self, row_id: impl Into<String>) {
        let id = row_id.into();
        self.row_edit_state.error_row_ids.insert(id.clone());
        self.row_edit_state.dirty_row_ids.insert(id.clone());
        self.row_edit_state.saving_row_ids.remove(&id);
        self.pipeline_dirty = true;
    }

    /// Read the current per-column width overrides. The map keys are
    /// column names; values are CSS-style width strings (e.g.
    /// `"180px"`). Hosts can persist this independently of the
    /// `save_state` round-trip.
    pub fn column_width_overrides(&self) -> &BTreeMap<String, String> {
        &self.column_widths
    }

    /// Set a per-column width override programmatically. Cleared by
    /// passing `None`.
    pub fn set_column_width_override(&mut self, column_name: &str, width: Option<String>) {
        match width {
            Some(value) => {
                self.column_widths.insert(column_name.to_string(), value);
            }
            None => {
                self.column_widths.remove(column_name);
            }
        }
    }

    /// Check whether the cached body scroll position is close enough
    /// to the bottom that the host should load more data, and emit a
    /// [`EguiGridEventKind::NeedLoadMoreData`] event when so. Mirrors
    /// the TS `needLoadMoreData` heuristic. Idempotent within a frame
    /// — successive calls without a row count change won't re-emit.
    /// `offset_y` is the body's current scroll offset; `viewport_h`
    /// is the visible body height; `row_height` is the per-row pixel
    /// size; `total_rows` is the number of pipeline-visible rows.
    fn maybe_emit_load_more(
        &mut self,
        options: &GridOptions,
        offset_y: f32,
        viewport_h: f32,
        row_height: f32,
        total_rows: usize,
    ) {
        // Only emit when infinite scroll is wired up. `infinite_scroll_down`
        // is the TS-equivalent gate (defaults to off when unset).
        if !options.infinite_scroll_down.unwrap_or(false) {
            return;
        }
        if total_rows == 0 || row_height <= 0.0 {
            return;
        }
        let from_end = options.infinite_scroll_rows_from_end.unwrap_or(20);
        let trigger_band = (from_end as f32) * row_height;
        let body_h = total_rows as f32 * row_height;
        let bottom_distance = body_h - (offset_y + viewport_h);
        if bottom_distance <= trigger_band && self.last_load_more_total_rows != Some(total_rows) {
            self.last_load_more_total_rows = Some(total_rows);
            self.events.push(EguiGridEvent {
                kind: EguiGridEventKind::NeedLoadMoreData,
            });
        }
    }

    /// Run a host-agnostic pipeline benchmark against the current
    /// options + column state. Mirrors TS `gridApi.core.benchmark`:
    /// runs the pipeline `iterations` times and reports total /
    /// average / visible-row / rendered-item counts. The default
    /// iteration count when callers pass `None` is 25, matching the
    /// TS fallback.
    pub fn run_benchmark(
        &self,
        options: &GridOptions,
        columns: &[GridColumnDef],
        iterations: Option<usize>,
    ) -> Option<ui_grid_core::benchmark::GridBenchmarkResult> {
        let n = iterations.unwrap_or(25);
        let context = self.pipeline_context_for_benchmark(options, columns);
        ui_grid_core::benchmark::run_grid_benchmark(&context, n)
    }

    /// Build the same pipeline context `refresh_pipeline` would
    /// build, but without mutating cached state. Used by the
    /// benchmark probe so it doesn't disturb the rendered grid.
    fn pipeline_context_for_benchmark(
        &self,
        options: &GridOptions,
        columns: &[GridColumnDef],
    ) -> BuildGridPipelineContext {
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
        BuildGridPipelineContext {
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
        }
    }

    /// Auto-fit a single column to the widest visible cell + header.
    /// Mirrors the TS `measureAutoColumnWidth` UX from
    /// `vanilla/src/focus.ts` — that path clones the cell DOM and
    /// reads `scrollWidth`; egui has no DOM, so we measure each
    /// rendered cell's display string + the header label via
    /// `egui::Fonts::layout_no_wrap` and pick the widest, then store
    /// the result as a `"<px>px"` width override.
    ///
    /// The override is applied via [`column_widths`](Self::column_width_overrides)
    /// so save/restore round-trips preserve it. `padding_px` is added
    /// on top of the measured width as breathing room (cell padding).
    /// Reasonable defaults: ~24px (matching the grid's cell padding).
    pub fn auto_fit_column(
        &mut self,
        ctx: &egui::Context,
        columns: &[GridColumnDef],
        column_name: &str,
        padding_px: f32,
    ) {
        let Some(column) = columns.iter().find(|c| c.name == column_name) else {
            return;
        };
        let header_text = header_label(column);
        let mut max_width = ctx.fonts_mut(|fonts| {
            fonts
                .layout_no_wrap(header_text, egui::FontId::default(), egui::Color32::WHITE)
                .size()
                .x
        });
        for row in &self.cached_result.visible_rows {
            let text = format_grid_cell_display_value(row, column);
            if text.is_empty() {
                continue;
            }
            let width = ctx.fonts_mut(|fonts| {
                fonts
                    .layout_no_wrap(text, egui::FontId::default(), egui::Color32::WHITE)
                    .size()
                    .x
            });
            if width > max_width {
                max_width = width;
            }
        }
        let total = (max_width + padding_px).ceil() as i32;
        self.column_widths
            .insert(column_name.to_string(), format!("{total}px"));
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

    pub fn column_order(&self) -> &[String] {
        &self.column_order
    }

    pub fn pinned_columns(&self) -> &PinnedColumnState {
        &self.pinned_columns
    }

    pub fn pin_column(&mut self, column_name: &str, direction: PinDirection) {
        self.set_column_pin_direction(column_name, direction);
    }

    pub fn move_column_before(&mut self, column_name: &str, target_column_name: &str) {
        self.reorder_column_before(column_name, target_column_name);
    }

    pub fn export_context<'a>(
        &'a self,
        options: &'a GridOptions,
        columns: &'a [GridColumnDef],
    ) -> GridExportContext<'a> {
        build_grid_export_context(&options.id, columns, &self.cached_result.visible_rows)
    }

    pub fn export_csv(
        &self,
        options: &GridOptions,
        columns: &[GridColumnDef],
    ) -> GridExportPayload {
        build_csv_export_payload(&self.export_context(options, columns))
    }

    pub fn export_with<'a, T>(
        &'a self,
        options: &'a GridOptions,
        columns: &'a [GridColumnDef],
        exporter: impl FnOnce(GridExportContext<'a>) -> T,
    ) -> T {
        exporter(self.export_context(options, columns))
    }

    /// Register an exporter against the global exporter registry. The
    /// registry is process-wide and shared across every `EguiGrid`
    /// instance — exporters registered here are reachable from
    /// [`EguiGrid::export`] on any grid in the process. Mirrors the TS
    /// contract where consumers register exporters once at startup.
    pub fn register_exporter(format: impl Into<String>, exporter: Arc<dyn GridExporter>) {
        register_grid_exporter(format, exporter);
    }

    /// Drop a previously-registered exporter. Returns the prior
    /// registration when one existed.
    pub fn unregister_exporter(format: &str) -> Option<Arc<dyn GridExporter>> {
        unregister_grid_exporter(format)
    }

    /// Run the exporter registered for `format` against the current
    /// pipeline result, scoped to `scope`. The default scope is
    /// `Visible` (post-filter / post-sort / post-paginate); see
    /// [`GridExportScope`] for the others.
    pub fn export(
        &self,
        options: &GridOptions,
        columns: &[GridColumnDef],
        format: &str,
        scope: GridExportScope,
    ) -> Result<GridExportResult, UnknownExportFormat> {
        let rows: Vec<GridRow> = match scope {
            GridExportScope::Visible => self.cached_result.visible_rows.clone(),
            GridExportScope::All => options
                .data
                .iter()
                .enumerate()
                .map(|(index, entity)| {
                    GridRow::new(
                        format!("{}-{}", options.id, index),
                        entity.clone(),
                        index,
                        44,
                    )
                })
                .collect(),
            GridExportScope::Selected => self
                .cached_result
                .visible_rows
                .iter()
                .filter(|row| self.selected_row_ids.iter().any(|id| id == &row.id))
                .cloned()
                .collect(),
        };

        // Pre-format every cell in row-major order so consumer
        // exporters don't have to walk `format_grid_cell_display_value`
        // themselves.
        let formatted_cells = rows
            .iter()
            .map(|row| {
                columns
                    .iter()
                    .map(|column| format_grid_cell_display_value(row, column))
                    .collect()
            })
            .collect();

        let ctx = GridRegisteredExportContext {
            columns,
            rows: &rows,
            formatted_cells,
            options,
            scope,
            format,
        };
        ui_grid_core::exporter_registry::export_grid(format, &ctx)
    }

    pub fn set_group_by(&mut self, columns: Vec<String>) {
        self.group_by_columns = columns;
        self.pipeline_dirty = true;
    }

    pub fn save_state(&self) -> ui_grid_core::models::GridSavedState {
        ui_grid_core::state::build_grid_saved_state(BuildGridSavedStateContext {
            column_order: self.column_order.clone(),
            active_filters: self.active_filters.clone(),
            sort_state: self.sort_state.clone(),
            group_by_columns: self.group_by_columns.clone(),
            current_page: self.current_page,
            page_size: self.page_size,
            total_items: self.cached_result.total_items,
            expanded_rows: self.expanded_rows.clone(),
            expanded_tree_rows: self.expanded_tree_rows.clone(),
            pinned_columns: self.pinned_columns.clone(),
            column_width_overrides: self.column_widths.clone(),
        })
    }

    pub fn serialize_state(&self) -> Result<String, serde_json::Error> {
        serialize_grid_saved_state(&self.save_state())
    }

    pub fn serialize_state_with<T>(
        &self,
        serializer: impl FnOnce(&ui_grid_core::models::GridSavedState) -> T,
    ) -> T {
        serialize_grid_saved_state_with(&self.save_state(), serializer)
    }

    pub fn restore_state(&mut self, state: &ui_grid_core::models::GridSavedState) {
        let plan = create_grid_restore_mutation_plan(state);

        if let Some(column_order) = plan.column_order {
            self.column_order = column_order;
        }
        if let Some(filters) = plan.filters {
            self.active_filters = filters;
        }
        if let Some(sort) = plan.sort {
            self.sort_state = sort;
        }
        if let Some(grouping) = plan.grouping {
            self.group_by_columns = grouping;
        }
        if let Some(pagination) = plan.pagination {
            self.current_page = pagination.pagination_current_page;
            self.page_size = pagination.pagination_page_size;
        }
        if let Some(expandable) = plan.expandable {
            self.expanded_rows = expandable;
        }
        if let Some(tree_view) = plan.tree_view {
            self.expanded_tree_rows = tree_view;
        }
        if let Some(pinning) = plan.pinning {
            self.pinned_columns = pinning;
        }
        if let Some(widths) = plan.column_width_overrides {
            self.column_widths = widths;
        }

        self.pipeline_dirty = true;
    }

    pub fn deserialize_state(&mut self, value: &str) -> Result<(), serde_json::Error> {
        let state = deserialize_grid_saved_state(value)?;
        self.restore_state(&state);
        Ok(())
    }

    pub fn deserialize_state_with<T, E>(
        &mut self,
        value: T,
        deserializer: impl FnOnce(T) -> Result<ui_grid_core::models::GridSavedState, E>,
    ) -> Result<(), E> {
        let state = deserialize_grid_saved_state_with(value, deserializer)?;
        self.restore_state(&state);
        Ok(())
    }

    fn sync_column_state(&mut self, columns: &[GridColumnDef]) {
        let current_names = columns
            .iter()
            .map(|column| column.name.clone())
            .collect::<Vec<_>>();

        self.column_order
            .retain(|name| current_names.contains(name));
        for name in &current_names {
            if !self.column_order.contains(name) {
                self.column_order.push(name.clone());
            }
        }

        self.pinned_columns
            .retain(|name, _| current_names.iter().any(|current| current == name));
        for (name, direction) in build_initial_pinned_state(columns) {
            self.pinned_columns.entry(name).or_insert(direction);
        }
    }

    fn resolve_columns(&self, columns: &[GridColumnDef]) -> Vec<GridColumnDef> {
        let by_name = columns
            .iter()
            .cloned()
            .map(|column| (column.name.clone(), column))
            .collect::<BTreeMap<_, _>>();

        let mut ordered = Vec::with_capacity(columns.len());
        for name in &self.column_order {
            if let Some(column) = by_name.get(name) {
                ordered.push(column.clone());
            }
        }

        let mut left = Vec::new();
        let mut center = Vec::new();
        let mut right = Vec::new();

        for column in ordered {
            match get_column_pin_direction(&self.pinned_columns, &column) {
                PinDirection::Left => left.push(column),
                PinDirection::Right => right.push(column),
                PinDirection::None => center.push(column),
            }
        }

        left.into_iter().chain(center).chain(right).collect()
    }

    fn cycle_sort_for_column(&mut self, column_name: &str) {
        let is_active = self.sort_state.column_name.as_deref() == Some(column_name);
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
                Some(column_name.to_string())
            },
            direction: next_direction,
        };
        self.current_page = 1;
        self.pipeline_dirty = true;

        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::SortChanged {
                column: column_name.to_string(),
                direction: next_direction,
            },
        });
    }

    fn set_column_pin_direction(&mut self, column_name: &str, direction: PinDirection) {
        let previous = self.pinned_columns.clone();
        self.pinned_columns = pin_column_state(&self.pinned_columns, column_name, direction);
        if self.pinned_columns != previous {
            self.pipeline_dirty = true;
            self.events.push(EguiGridEvent {
                kind: EguiGridEventKind::ColumnPinned {
                    column: column_name.to_string(),
                    direction,
                },
            });
        }
    }

    fn move_column_relative(&mut self, column_name: &str, delta: isize) {
        let Some(index) = self
            .column_order
            .iter()
            .position(|name| name == column_name)
        else {
            return;
        };
        let next_index = (index as isize + delta).clamp(0, self.column_order.len() as isize - 1);
        let next_index = next_index as usize;
        if index == next_index {
            return;
        }

        let column = self.column_order.remove(index);
        self.column_order.insert(next_index, column);
        self.pipeline_dirty = true;
        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::ColumnsReordered {
                order: self.column_order.clone(),
            },
        });
    }

    fn reorder_column_before(&mut self, dragged: &str, target: &str) {
        if dragged == target {
            return;
        }

        let Some(from_index) = self.column_order.iter().position(|name| name == dragged) else {
            return;
        };
        let Some(mut to_index) = self.column_order.iter().position(|name| name == target) else {
            return;
        };

        let column = self.column_order.remove(from_index);
        if from_index < to_index {
            to_index -= 1;
        }
        self.column_order.insert(to_index, column);
        self.pipeline_dirty = true;
        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::ColumnsReordered {
                order: self.column_order.clone(),
            },
        });
    }

    fn reorder_column_after(&mut self, dragged: &str, target: &str) {
        if dragged == target {
            return;
        }

        let Some(from_index) = self.column_order.iter().position(|name| name == dragged) else {
            return;
        };
        let Some(target_index) = self.column_order.iter().position(|name| name == target) else {
            return;
        };

        let column = self.column_order.remove(from_index);
        let insert_index = if from_index < target_index {
            target_index
        } else {
            target_index + 1
        };
        self.column_order.insert(insert_index, column);
        self.pipeline_dirty = true;
        self.events.push(EguiGridEvent {
            kind: EguiGridEventKind::ColumnsReordered {
                order: self.column_order.clone(),
            },
        });
    }

    pub fn reset(&mut self) {
        *self = Self {
            page_size: self.page_size,
            ..Self::new()
        };
    }

    /// Mark the data pipeline as dirty so it re-runs on the next frame.
    /// Call this after mutating `GridOptions::data` externally (e.g. live data updates).
    pub fn mark_dirty(&mut self) {
        self.pipeline_dirty = true;
    }

    pub fn show(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        theme: &GridTheme,
    ) {
        self.sync_column_state(columns);
        // Refresh the validator registry from the host's labels so
        // tooltip messages pick up consumer overrides. Cheap — the
        // registry is just labels + a small extras map.
        self.validator_registry =
            ui_grid_core::validate::create_grid_validator_registry(&options.labels);
        let mut ordered_columns = self.resolve_columns(columns);

        // Inject the synthetic selection-row-header column before the
        // first user-defined column. Mirrors the TS injection — the
        // sentinel name is recognised throughout the core (viewmodel,
        // exporter, save-state) so other features handle it correctly
        // without further changes.
        if should_show_selection_row_header(options)
            && !ordered_columns
                .iter()
                .any(|column| column.name == SELECTION_ROW_HEADER_COL_NAME)
        {
            ordered_columns.insert(0, build_selection_row_header_column());
        }

        self.handle_keyboard_navigation(ui, options, &ordered_columns);
        self.refresh_pipeline(options, &ordered_columns);

        if ordered_columns.is_empty() {
            ui.label("No columns defined.");
            return;
        }

        let total_items = self.cached_result.total_items;
        let display_items = std::mem::take(&mut self.cached_result.display_items);

        let mut left_columns = Vec::new();
        let mut center_columns = Vec::new();
        let mut right_columns = Vec::new();
        for column in &ordered_columns {
            match get_column_pin_direction(&self.pinned_columns, column) {
                PinDirection::Left => left_columns.push(column.clone()),
                PinDirection::Right => right_columns.push(column.clone()),
                PinDirection::None => center_columns.push(column.clone()),
            }
        }
        let has_pinned = !left_columns.is_empty() || !right_columns.is_empty();
        const COL_W: f32 = 176.0;
        let left_w = left_columns.len() as f32 * COL_W;
        let right_w = right_columns.len() as f32 * COL_W;

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

                if !has_pinned {
                    egui::ScrollArea::horizontal()
                        .auto_shrink([false, false])
                        .show(ui, |ui| {
                            ui.set_min_width(
                                (ordered_columns.len() as f32 * COL_W).max(ui.available_width()),
                            );
                            self.draw_table(
                                ui,
                                options,
                                &ordered_columns,
                                column_ext,
                                &display_items,
                                theme,
                                true,
                                None,
                                None,
                                true,
                            );
                        });
                    return;
                }

                // Sticky pinned layout: three side-by-side regions, each with its own
                // sticky header (via TableBuilder vscroll). Vertical scroll is synchronized
                // across all three regions via a shared offset stored on `self`.
                let total_w = ui.available_width();
                let avail_h = ui.available_height();
                let center_w = (total_w - left_w - right_w).max(80.0);
                ui.spacing_mut().item_spacing.x = 0.0;
                let stored_offset = self.pinned_scroll_offset_y;
                let mut new_offset = stored_offset;
                ui.horizontal_top(|ui| {
                    if !left_columns.is_empty() {
                        ui.allocate_ui_with_layout(
                            Vec2::new(left_w, avail_h),
                            egui::Layout::top_down(egui::Align::Min),
                            |ui| {
                                ui.set_min_width(left_w);
                                if let Some(out) = self.draw_table(
                                    ui,
                                    options,
                                    &left_columns,
                                    column_ext,
                                    &display_items,
                                    theme,
                                    true,
                                    Some("grid_left_table"),
                                    Some(stored_offset),
                                    false,
                                ) && (out - stored_offset).abs() > 0.5
                                {
                                    new_offset = out;
                                }
                            },
                        );
                    }

                    if !center_columns.is_empty() {
                        ui.allocate_ui_with_layout(
                            Vec2::new(center_w, avail_h),
                            egui::Layout::top_down(egui::Align::Min),
                            |ui| {
                                egui::ScrollArea::horizontal()
                                    .id_salt("grid_center_hscroll")
                                    .auto_shrink([false, false])
                                    .min_scrolled_width(0.0)
                                    .show(ui, |ui| {
                                        let inner_w =
                                            (center_columns.len() as f32 * COL_W).max(center_w);
                                        ui.set_min_width(inner_w);
                                        if let Some(out) = self.draw_table(
                                            ui,
                                            options,
                                            &center_columns,
                                            column_ext,
                                            &display_items,
                                            theme,
                                            true,
                                            Some("grid_center_table"),
                                            Some(stored_offset),
                                            true,
                                        ) && (out - stored_offset).abs() > 0.5
                                        {
                                            new_offset = out;
                                        }
                                    });
                            },
                        );
                    }

                    if !right_columns.is_empty() {
                        ui.allocate_ui_with_layout(
                            Vec2::new(right_w, avail_h),
                            egui::Layout::top_down(egui::Align::Min),
                            |ui| {
                                ui.set_min_width(right_w);
                                if let Some(out) = self.draw_table(
                                    ui,
                                    options,
                                    &right_columns,
                                    column_ext,
                                    &display_items,
                                    theme,
                                    true,
                                    Some("grid_right_table"),
                                    Some(stored_offset),
                                    false,
                                ) && (out - stored_offset).abs() > 0.5
                                {
                                    new_offset = out;
                                }
                            },
                        );
                    }
                });
                if (new_offset - stored_offset).abs() > 0.5 {
                    self.pinned_scroll_offset_y = new_offset;
                }
            });

        // Fire `NeedLoadMoreData` if the body is near the bottom and
        // infinite-scroll is wired up. Uses the cached scroll offset
        // (the pinned variant tracks it; the unpinned variant always
        // resets to 0, so no false-fire there).
        let row_height = theme.row_height;
        let viewport_h = ui.available_height();
        self.maybe_emit_load_more(
            options,
            self.pinned_scroll_offset_y,
            viewport_h,
            row_height,
            self.cached_result.visible_rows.len(),
        );

        self.cached_result.display_items = display_items;
    }

    /// True when any `KeyOverrideSpec` declared on `options` matches
    /// the supplied key + modifier state. Hosts use this to opt out
    /// of built-in keydown handling (Ctrl+A, F2, Home/End, etc.).
    fn key_overridden(
        options: &GridOptions,
        key: &str,
        shift: bool,
        ctrl: bool,
        alt: bool,
        meta: bool,
    ) -> bool {
        options
            .key_down_overrides
            .iter()
            .any(|spec| spec.matches(key, shift, ctrl, alt, meta))
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
                i.key_pressed(Key::Space),
                i.modifiers.command && i.key_pressed(Key::A),
            )
        });
        let (tab, enter, escape, up, down, left, right, shift, space, select_all) = input;
        let (ctrl_held, alt_held, meta_held) =
            ui.input(|i| (i.modifiers.ctrl, i.modifiers.alt, i.modifiers.mac_cmd));

        // Additional keys / modifier combos read via a second `ui.input`
        // call to keep the upstream tuple within readable bounds.
        let (f2, home, end, command_held, first_char) = ui.input(|i| {
            // First printable character pressed this frame, if any —
            // used to begin an edit pre-seeded with the typed character.
            // We deliberately ignore characters reported while a
            // modifier (Cmd/Ctrl/Alt) is held so accelerators don't
            // accidentally trigger edit mode.
            let printable = i.events.iter().find_map(|event| match event {
                egui::Event::Text(text) if !text.is_empty() && !i.modifiers.command => {
                    text.chars().next()
                }
                _ => None,
            });
            (
                i.key_pressed(Key::F2),
                i.key_pressed(Key::Home),
                i.key_pressed(Key::End),
                i.modifiers.command,
                printable,
            )
        });

        // Ctrl+A / Cmd+A — select every selectable row, gated by
        // `enable_row_selection` and `enable_select_all` (both default
        // off / on respectively to mirror the TS contract). Skips
        // entirely while editing so the shortcut doesn't steal text
        // selection behaviour from the editor.
        if select_all
            && self.edit_session.is_none()
            && !Self::key_overridden(options, "a", shift, ctrl_held, alt_held, meta_held)
        {
            if options.enable_row_selection.unwrap_or(false)
                && options.enable_select_all.unwrap_or(true)
            {
                let initial = self.selected_row_ids.clone();
                let batch_events = options.enable_selection_batch_event.unwrap_or(true);
                self.selected_row_ids = self
                    .cached_result
                    .visible_rows
                    .iter()
                    .filter(|row| row.enable_selection)
                    .map(|row| row.id.clone())
                    .collect();
                self.emit_selection_event(&initial, batch_events);
            }
            return;
        }

        // Space — toggle the focused row's selection. Mirrors the
        // keyboard contract used by the vanilla web component.
        if space
            && self.edit_session.is_none()
            && options.enable_row_selection.unwrap_or(false)
            && !Self::key_overridden(options, " ", shift, ctrl_held, alt_held, meta_held)
            && let Some(ref focused) = self.focused_cell
        {
            let row_id = focused.row_id.clone();
            self.handle_row_click(
                options,
                &row_id,
                RowClickModifiers {
                    shift: false,
                    toggle: true, // Space is conceptually an additive toggle.
                },
            );
            return;
        }

        if escape && self.edit_session.is_some() {
            self.edit_session = None;
            return;
        }

        if enter && self.edit_session.is_some() {
            self.commit_edit(options, columns);
            if let Some(ref focused) = self.focused_cell
                && let Some(next) = find_next_grid_cell(
                    &self.cached_result.visible_rows,
                    columns,
                    &focused.row_id,
                    &focused.column_name,
                    GridMoveDirection::Down,
                    None::<fn(&_, &_) -> bool>,
                )
            {
                let position = GridCellPosition {
                    row_id: next.row.id.clone(),
                    column_name: next.column.name.clone(),
                };
                self.begin_edit_at(&position, options, columns);
            }
            return;
        }

        if enter && self.edit_session.is_none() {
            if let Some(ref focused) = self.focused_cell.clone() {
                self.begin_edit_at(focused, options, columns);
            }
            return;
        }

        // F2 — alternate begin-edit binding to match the spreadsheet
        // convention. Behaves identically to Enter on a focused cell.
        if f2
            && self.edit_session.is_none()
            && !Self::key_overridden(options, "F2", shift, ctrl_held, alt_held, meta_held)
            && let Some(ref focused) = self.focused_cell.clone()
        {
            self.begin_edit_at(focused, options, columns);
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
            if let Some(ref focused) = self.focused_cell.clone()
                && let Some(next) = find_next_grid_cell(
                    &self.cached_result.visible_rows,
                    columns,
                    &focused.row_id,
                    &focused.column_name,
                    dir,
                    None::<fn(&_, &_) -> bool>,
                )
            {
                let position = GridCellPosition {
                    row_id: next.row.id.clone(),
                    column_name: next.column.name.clone(),
                };
                self.begin_edit_at(&position, options, columns);
            }
            return;
        }

        if self.edit_session.is_some() {
            return;
        }

        // Ctrl+Home / Ctrl+End — jump to the first or last visible row
        // while keeping the focused column. Mirrors the
        // spreadsheet-style binding used by the vanilla web component.
        let home_end_key = if home { "Home" } else { "End" };
        if command_held
            && (home || end)
            && !Self::key_overridden(options, home_end_key, shift, ctrl_held, alt_held, meta_held)
            && let Some(ref focused) = self.focused_cell.clone()
        {
            let rows = &self.cached_result.visible_rows;
            let target_row = if home { rows.first() } else { rows.last() };
            if let Some(target) = target_row {
                let position = GridCellPosition {
                    row_id: target.id.clone(),
                    column_name: focused.column_name.clone(),
                };
                self.focused_cell = Some(position.clone());
                self.selected_row_ids = vec![position.row_id.clone()];
                self.last_clicked_row_id = Some(position.row_id);
            }
            return;
        }

        // Home / End — move focus to the first or last column on the
        // current row. Honors `enable_cell_navigation` semantics
        // implicitly through `find_next_grid_cell`.
        if (home || end)
            && !command_held
            && !Self::key_overridden(options, home_end_key, shift, ctrl_held, alt_held, meta_held)
            && let Some(ref focused) = self.focused_cell.clone()
            && let Some(target_column) = (if home {
                columns.first()
            } else {
                columns.last()
            })
        {
            let position = GridCellPosition {
                row_id: focused.row_id.clone(),
                column_name: target_column.name.clone(),
            };
            self.focused_cell = Some(position.clone());
            self.selected_row_ids = vec![position.row_id.clone()];
            self.last_clicked_row_id = Some(position.row_id);
            return;
        }

        // First-character keypress — begin editing the focused cell
        // pre-seeded with the typed character. Skipped when no cell
        // is focused, when no column is editable, or when a modifier
        // (Cmd/Ctrl/Alt) was held (those are handled by the input
        // gather above as accelerators).
        if let Some(ch) = first_char
            && let Some(ref focused) = self.focused_cell.clone()
        {
            let column = columns.iter().find(|c| c.name == focused.column_name);
            let is_editable =
                column.is_some_and(|c| c.enable_cell_edit || options.enable_cell_edit);
            if is_editable {
                let session =
                    begin_grid_edit_session(&focused.row_id, &focused.column_name, ch.to_string());
                self.edit_session = Some(session);
                return;
            }
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

        if let Some(dir) = direction
            && let Some(ref focused) = self.focused_cell.clone()
            && let Some(next) = find_next_grid_cell(
                &self.cached_result.visible_rows,
                columns,
                &focused.row_id,
                &focused.column_name,
                dir,
                None::<fn(&_, &_) -> bool>,
            )
        {
            let position = GridCellPosition {
                row_id: next.row.id.clone(),
                column_name: next.column.name.clone(),
            };
            self.focused_cell = Some(position.clone());
            self.selected_row_ids = vec![position.row_id.clone()];
            self.last_clicked_row_id = Some(position.row_id);
        }
    }

    fn begin_edit_at(
        &mut self,
        position: &GridCellPosition,
        options: &GridOptions,
        columns: &[GridColumnDef],
    ) {
        let column = columns.iter().find(|c| c.name == position.column_name);
        let is_editable = column.is_some_and(|c| c.enable_cell_edit || options.enable_cell_edit);
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

        let new_value = parse_grid_edited_value(column, &session.editing_value, &old_value);

        if new_value != old_value {
            if let Some(row) = options.data.iter_mut().find(|r| {
                r.get("id")
                    .and_then(|v| v.as_str())
                    .is_some_and(|id| id == session.editing_cell.row_id)
            }) && let Some(obj) = row.as_object_mut()
            {
                obj.insert(field.to_string(), new_value.clone());
                // Run any validators declared on the column. The
                // helper stamps `$$invalid<col>` and per-validator
                // error keys directly on the entity, which the cell
                // paint path picks up via `is_grid_cell_invalid` and
                // the validation chrome (border + tooltip).
                if column.validators.is_some() {
                    let mut entity = serde_json::Value::Object(obj.clone());
                    let _ = run_grid_cell_validators(
                        &mut entity,
                        column,
                        &new_value,
                        &old_value,
                        &self.validator_registry,
                    );
                    if let Some(updated) = entity.as_object() {
                        obj.clone_from(updated);
                    }
                }
            }

            // Mark the row dirty so the row-edit chrome lights up. The
            // pipeline rebuild resets per-row flags every pass; the
            // `row_edit_state` set persists the dirty marker across
            // rebuilds via `refresh_pipeline`.
            self.row_edit_state
                .dirty_row_ids
                .insert(session.editing_cell.row_id.clone());
            self.row_edit_state
                .error_row_ids
                .remove(&session.editing_cell.row_id);

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

    #[allow(clippy::too_many_arguments)]
    fn draw_table(
        &mut self,
        ui: &mut Ui,
        options: &mut GridOptions,
        columns: &[GridColumnDef],
        column_ext: &mut [EguiColumnExt],
        display_items: &[DisplayItem],
        theme: &GridTheme,
        vscroll: bool,
        id_salt: Option<&str>,
        scroll_offset_y: Option<f32>,
        scroll_bar_visible: bool,
    ) -> Option<f32> {
        let show_filters = options.enable_filtering;
        let label_row_h = theme.header_padding_y + 20.0;
        let header_height = if show_filters {
            label_row_h + theme.filter_padding_y + 22.0 + 4.0
        } else {
            label_row_h + theme.header_padding_y
        };

        let resizable = options.enable_column_resizing;
        let mut table = TableBuilder::new(ui)
            .striped(false)
            .vscroll(vscroll)
            .resizable(resizable)
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center));

        if let Some(salt) = id_salt {
            table = table.id_salt(salt);
        }
        if let Some(offset) = scroll_offset_y {
            table = table.vertical_scroll_offset(offset);
        }
        if !scroll_bar_visible {
            table =
                table.scroll_bar_visibility(egui::scroll_area::ScrollBarVisibility::AlwaysHidden);
        }

        for _ in columns {
            table = table.column(Column::initial(176.0).resizable(resizable).clip(true));
        }

        let has_mixed_heights = display_items
            .iter()
            .any(|item| !matches!(item, DisplayItem::Row(_)));

        let body_output = table
            .header(header_height, |mut header| {
                for col in columns.iter() {
                    header.col(|ui| {
                        let rect = ui.max_rect();
                        let pin_direction = get_column_pin_direction(&self.pinned_columns, col);
                        let header_background = if pin_direction == PinDirection::None {
                            theme.header_background
                        } else {
                            theme.pinned_header_background
                        };
                        ui.painter().rect_filled(rect, 0.0, header_background);

                        let is_sort_active = self.sort_state.column_name.as_ref()
                            == Some(&col.name)
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

                        if pin_direction != PinDirection::None {
                            let x = if pin_direction == PinDirection::Left {
                                rect.min.x
                            } else {
                                rect.max.x - 3.0
                            };
                            let pin_indicator = egui::Rect::from_min_size(
                                egui::pos2(x, rect.min.y),
                                Vec2::new(3.0, rect.height()),
                            );
                            ui.painter()
                                .rect_filled(pin_indicator, 0.0, theme.pinned_indicator);
                        }

                        ui.vertical(|ui| {
                            ui.spacing_mut().item_spacing.y = 2.0;
                            ui.add_space(theme.header_padding_y * 0.5);
                            let header_label_id = self.draw_header_row(
                                ui,
                                options,
                                col,
                                find_column_ext_mut(column_ext, &col.name),
                                theme,
                                egui::Rect::from_min_max(
                                    rect.min,
                                    egui::pos2(rect.max.x, rect.min.y + label_row_h),
                                ),
                            );
                            if show_filters {
                                ui.add_space(2.0);
                                self.draw_filter_input(
                                    ui,
                                    options,
                                    col,
                                    find_column_ext_mut(column_ext, &col.name),
                                    theme,
                                    header_label_id,
                                );
                            }
                        });
                    });
                }
            })
            .body(|mut body| {
                // Empty-state — emit a single full-height row hosting
                // the consumer's renderer (or a default heading + body).
                // Painted only when the pipeline produced no display
                // items at all; non-empty bodies fall through to the
                // regular per-row dispatch below.
                if display_items.is_empty() && !columns.is_empty() {
                    body.row(theme.row_height * 4.0, |mut row| {
                        // Span by drawing the empty-state into the
                        // first column cell only; the remaining cells
                        // are left blank so the table layout stays
                        // intact.
                        row.col(|ui| {
                            self.draw_empty_state_row(ui, options, theme);
                        });
                        for _ in 1..columns.len() {
                            row.col(|_| {});
                        }
                    });
                    return;
                }
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
                                        ui, options, columns, column_ext, item, col_index,
                                        row_index, theme,
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
                                        ui, options, columns, column_ext, item, col_index,
                                        row_index, theme,
                                    );
                                });
                            }
                        }
                    });
                }
            });

        if ui.input(|input| input.pointer.any_released()) {
            self.dragged_column = None;
        }

        if vscroll {
            Some(body_output.state.offset.y)
        } else {
            None
        }
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
        // Re-apply row-edit lifecycle flags to the freshly-built rows.
        // The pipeline resets `is_dirty` / `is_saving` / `is_error` to
        // false on every rebuild because they live on `GridRow`, not
        // on the source entity. Persisting them in `row_edit_state` and
        // re-stamping here is what gives the row-edit chrome its
        // session-stable lifetime.
        for row in self.cached_result.visible_rows.iter_mut() {
            if self.row_edit_state.dirty_row_ids.contains(&row.id) {
                row.is_dirty = true;
            }
            if self.row_edit_state.saving_row_ids.contains(&row.id) {
                row.is_saving = true;
            }
            if self.row_edit_state.error_row_ids.contains(&row.id) {
                row.is_error = true;
                row.is_dirty = true;
            }
        }
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
        column_ext: Option<&mut EguiColumnExt>,
        theme: &GridTheme,
        header_row_rect: egui::Rect,
    ) -> egui::Id {
        let can_move = can_grid_move_columns(options);

        // Drop-zone painting / drop handling for THIS column when another column is being dragged.
        // We paint the indicator BEFORE the content so children render on top.
        let active_payload = egui::DragAndDrop::payload::<String>(ui.ctx());
        let pointer_pos = ui.input(|input| input.pointer.hover_pos());
        let mut pending_drop: Option<(String, bool)> = None;
        if can_move && let Some(payload) = active_payload.as_deref() {
            if payload == column.name.as_str() {
                ui.painter().rect_stroke(
                    header_row_rect.shrink2(Vec2::splat(2.0)),
                    4.0,
                    egui::Stroke::new(1.0, theme.accent),
                    egui::StrokeKind::Inside,
                );
            } else if let Some(pos) = pointer_pos
                && header_row_rect.contains(pos)
            {
                let drop_after = pos.x >= header_row_rect.center().x;
                let drop_zone_rect = header_row_rect.shrink2(Vec2::new(2.0, 3.0));
                ui.painter()
                    .rect_filled(drop_zone_rect, 4.0, theme.control_hover_background);
                let marker_x = if drop_after {
                    header_row_rect.max.x - 2.0
                } else {
                    header_row_rect.min.x
                };
                let drop_marker = egui::Rect::from_min_size(
                    egui::pos2(marker_x, header_row_rect.min.y + 4.0),
                    Vec2::new(2.0, header_row_rect.height() - 8.0),
                );
                ui.painter().rect_filled(drop_marker, 1.0, theme.accent);

                if ui.input(|input| input.pointer.any_released()) {
                    pending_drop = Some((payload.clone(), drop_after));
                }
            }
        }

        let layout = self.draw_header_row_content(ui, options, column, column_ext, theme);

        if can_move {
            let drag_rect = egui::Rect::from_min_max(
                header_row_rect.min,
                egui::pos2(
                    layout
                        .controls_left_x
                        .clamp(header_row_rect.min.x + 12.0, header_row_rect.max.x),
                    header_row_rect.max.y,
                ),
            );
            let drag_id = ui.id().with(("header_drag", &column.name));
            let dnd_response = ui
                .scope_builder(egui::UiBuilder::new().max_rect(drag_rect), |ui| {
                    ui.dnd_drag_source(drag_id, column.name.clone(), |ui| {
                        ui.allocate_rect(ui.max_rect(), egui::Sense::hover())
                    })
                })
                .inner;
            if dnd_response.response.drag_started() {
                self.dragged_column = Some(column.name.clone());
            }
        }

        if let Some((dragged, drop_after)) = pending_drop {
            // Consume the payload so other columns don't also try to drop.
            let _ = egui::DragAndDrop::take_payload::<String>(ui.ctx());
            if drop_after {
                self.reorder_column_after(&dragged, &column.name);
            } else {
                self.reorder_column_before(&dragged, &column.name);
            }
        }

        layout.label_id
    }

    fn draw_header_row_content(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        column: &GridColumnDef,
        column_ext: Option<&mut EguiColumnExt>,
        theme: &GridTheme,
    ) -> HeaderRowLayout {
        // Synthetic checkbox column — render a select-all checkbox in
        // place of the usual sort / filter / pin chrome. Mirrors the
        // vanilla web component's behaviour for `selectionRowHeaderCol`.
        if column.name == SELECTION_ROW_HEADER_COL_NAME {
            return self.draw_select_all_header(ui, options, theme);
        }
        let label_text = header_label(column);
        let can_sort = options.enable_sorting && column.sortable && column.enable_sorting;
        let can_group = options.enable_grouping && column.enable_grouping;
        let can_pin = is_column_pinnable(options, column);
        let can_move = can_grid_move_columns(options);
        let is_grouped = is_grid_column_grouped(&self.group_by_columns, column);
        let pin_direction = get_column_pin_direction(&self.pinned_columns, column);
        let sort_direction = if self.sort_state.column_name.as_ref() == Some(&column.name) {
            self.sort_state.direction
        } else {
            SortDirection::None
        };
        let mut controls_left_x: Option<f32> = None;

        ui.horizontal(|ui| {
            ui.add_space(theme.header_padding_x);

            let label_response = ui.add(
                egui::Label::new(
                    egui::RichText::new(&label_text)
                        .color(theme.cell_color)
                        .strong(),
                )
                .sense(egui::Sense::hover()),
            );
            label_response.widget_info(|| {
                WidgetInfo::labeled(WidgetType::Label, ui.is_enabled(), &label_text)
            });

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(theme.header_padding_x);

                let mut actions = Vec::new();
                let context = GridHeaderControlsContext {
                    column,
                    labels: &options.labels,
                    icons: &options.icons,
                    theme,
                    is_grouped,
                    sort_direction,
                    pin_direction,
                    can_sort,
                    can_group,
                    can_pin,
                    can_move,
                };

                let mut handled = false;
                if let Some(column_ext) = column_ext
                    && let Some(renderer) = column_ext.header_controls_renderer.as_mut()
                {
                    renderer(ui, &context, &mut actions);
                    handled = true;
                }

                if !handled {
                    if can_pin {
                        match pin_direction {
                            PinDirection::Left | PinDirection::Right => {
                                if icon_button_labeled(
                                    ui,
                                    &grid_unpin_icon(&options.icons),
                                    theme,
                                    theme.accent,
                                    &options.labels.unpin,
                                    true,
                                )
                                .clicked()
                                {
                                    actions.push(EguiHeaderAction::Unpin);
                                }
                            }
                            PinDirection::None => {
                                if icon_button_labeled(
                                    ui,
                                    &grid_pin_right_icon(&options.icons),
                                    theme,
                                    theme.muted_color,
                                    &options.labels.pin_right,
                                    false,
                                )
                                .clicked()
                                {
                                    actions.push(EguiHeaderAction::PinRight);
                                }
                                if icon_button_labeled(
                                    ui,
                                    &grid_pin_left_icon(&options.icons),
                                    theme,
                                    theme.muted_color,
                                    &options.labels.pin_left,
                                    false,
                                )
                                .clicked()
                                {
                                    actions.push(EguiHeaderAction::PinLeft);
                                }
                            }
                        }
                    }

                    if can_group {
                        let group_color = if is_grouped {
                            theme.accent
                        } else {
                            theme.muted_color
                        };
                        let group_label = grid_grouping_button_label(is_grouped, &options.labels);
                        if icon_button_labeled(
                            ui,
                            &grid_grouping_button_icon(is_grouped, &options.icons),
                            theme,
                            group_color,
                            &group_label,
                            is_grouped,
                        )
                        .clicked()
                        {
                            actions.push(EguiHeaderAction::ToggleGrouping);
                        }
                    }

                    if can_sort {
                        let is_active = self.sort_state.column_name.as_ref() == Some(&column.name);
                        let (color, direction) = if is_active {
                            match self.sort_state.direction {
                                SortDirection::Asc => (theme.accent, SortDirection::Asc),
                                SortDirection::Desc => (theme.accent, SortDirection::Desc),
                                SortDirection::None => (theme.muted_color, SortDirection::None),
                            }
                        } else {
                            (theme.muted_color, SortDirection::None)
                        };

                        let sort_label = grid_sort_button_label(direction, &options.labels);
                        if icon_button_labeled(
                            ui,
                            &grid_sort_button_icon(direction, &options.icons),
                            theme,
                            color,
                            &sort_label,
                            is_active,
                        )
                        .clicked()
                        {
                            actions.push(EguiHeaderAction::CycleSort);
                        }
                    }
                }

                for action in actions {
                    match action {
                        EguiHeaderAction::ToggleGrouping => {
                            if is_grouped {
                                self.group_by_columns.retain(|name| name != &column.name);
                            } else {
                                self.group_by_columns.push(column.name.clone());
                            }
                            self.pipeline_dirty = true;
                        }
                        EguiHeaderAction::CycleSort => self.cycle_sort_for_column(&column.name),
                        EguiHeaderAction::PinLeft => {
                            self.set_column_pin_direction(&column.name, PinDirection::Left)
                        }
                        EguiHeaderAction::PinRight => {
                            self.set_column_pin_direction(&column.name, PinDirection::Right)
                        }
                        EguiHeaderAction::Unpin => {
                            self.set_column_pin_direction(&column.name, PinDirection::None)
                        }
                        EguiHeaderAction::MoveLeft => self.move_column_relative(&column.name, -1),
                        EguiHeaderAction::MoveRight => self.move_column_relative(&column.name, 1),
                    }
                }

                controls_left_x = Some(ui.min_rect().min.x);
            });

            HeaderRowLayout {
                label_id: label_response.id,
                controls_left_x: controls_left_x.unwrap_or(label_response.rect.max.x),
            }
        })
        .inner
    }

    /// Render the per-row selection checkbox shown in the synthetic
    /// `selectionRowHeaderCol`. Toggles route through the shared event
    /// helper so they emit single vs. batch events consistently with
    /// the rest of the selection chrome. Rows with
    /// `enable_selection: false` render a disabled checkbox.
    fn draw_row_selection_checkbox(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        row_item: &RowItem,
        theme: &GridTheme,
    ) {
        let rect = ui.max_rect();
        let is_selected = self
            .selected_row_ids
            .iter()
            .any(|id| id == &row_item.row.id);
        let bg = if is_selected {
            theme.accent_tint(30)
        } else {
            theme.surface
        };
        ui.painter().rect_filled(rect, 0.0, bg);
        let bottom = egui::Rect::from_min_size(
            egui::pos2(rect.min.x, rect.max.y - 1.0),
            Vec2::new(rect.width(), 1.0),
        );
        ui.painter().rect_filled(bottom, 0.0, theme.border_color);

        let response = ui
            .horizontal_centered(|ui| {
                ui.add_space(theme.cell_padding_x);
                ui.add_enabled(
                    row_item.row.enable_selection,
                    egui::Checkbox::new(&mut is_selected.clone(), ""),
                )
            })
            .inner;

        if response.clicked() && row_item.row.enable_selection {
            let row_id = row_item.row.id.clone();
            // Checkbox is conceptually an additive toggle — a click on
            // one row's checkbox should never wipe out the rest of the
            // selection. The shared handler treats `toggle: true` that
            // way regardless of the host modifier state.
            self.handle_row_click(
                options,
                &row_id,
                RowClickModifiers {
                    shift: false,
                    toggle: true,
                },
            );
        }
    }

    /// Render the select-all checkbox shown in the header of the
    /// synthetic `selectionRowHeaderCol`. Toggling selects every
    /// visible (post-filter / post-paginate) selectable row, or clears
    /// the selection if every visible row is already selected. Honors
    /// `enable_select_all`; when disabled, the checkbox is rendered
    /// non-interactive at its current state.
    fn draw_select_all_header(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        theme: &GridTheme,
    ) -> HeaderRowLayout {
        let selectable: Vec<&str> = self
            .cached_result
            .visible_rows
            .iter()
            .filter(|row| row.enable_selection)
            .map(|row| row.id.as_str())
            .collect();
        let all_selected = !selectable.is_empty()
            && selectable
                .iter()
                .all(|id| self.selected_row_ids.iter().any(|s| s == *id));
        let select_all_enabled = options.enable_select_all.unwrap_or(true);
        let batch_events = options.enable_selection_batch_event.unwrap_or(true);

        let response = ui
            .horizontal(|ui| {
                ui.add_space(theme.header_padding_x);
                ui.add_enabled(
                    select_all_enabled,
                    egui::Checkbox::new(&mut all_selected.clone(), ""),
                )
            })
            .inner;

        if response.clicked() && select_all_enabled {
            let initial = self.selected_row_ids.clone();
            self.selected_row_ids = if all_selected {
                Vec::new()
            } else {
                selectable.iter().map(|id| (*id).to_string()).collect()
            };
            self.emit_selection_event(&initial, batch_events);
        }

        HeaderRowLayout {
            label_id: response.id,
            controls_left_x: response.rect.max.x,
        }
    }

    fn draw_filter_input(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        column: &GridColumnDef,
        column_ext: Option<&mut EguiColumnExt>,
        theme: &GridTheme,
        labelled_by: egui::Id,
    ) {
        if !options.enable_filtering || !column.filterable || !column.enable_filtering {
            return;
        }

        let mut filter_text = self
            .active_filters
            .get(&column.name)
            .cloned()
            .unwrap_or_default();
        let initial = filter_text.clone();

        let custom_changed = if let Some(ext) = column_ext
            && let Some(renderer) = ext.filter_renderer.as_mut()
        {
            let context = GridFilterContext {
                column,
                labels: &options.labels,
                theme,
            };
            let mut changed = false;
            ui.horizontal(|ui| {
                ui.add_space(theme.header_padding_x);
                if renderer(ui, &context, &mut filter_text) {
                    changed = true;
                }
            });
            Some(changed)
        } else {
            None
        };

        if custom_changed.is_none() {
            ui.horizontal(|ui| {
                ui.add_space(theme.header_padding_x);

                let trailing = theme.header_padding_x;
                let clear_size = if filter_text.is_empty() {
                    0.0
                } else {
                    // Reserve space for the inline ✕ clear button.
                    18.0
                };
                let available = ui.available_width() - trailing - clear_size;
                let text_edit = egui::TextEdit::singleline(&mut filter_text)
                    .hint_text(grid_filter_placeholder(true, &options.labels))
                    .desired_width(available.max(40.0))
                    .text_color(theme.cell_color)
                    .show(ui);
                let response =
                    <Response as Clone>::clone(&text_edit.response).labelled_by(labelled_by);
                response.widget_info(|| {
                    WidgetInfo::labeled(
                        WidgetType::TextEdit,
                        ui.is_enabled(),
                        &options.labels.filter_column,
                    )
                });

                // Inline ✕ clear button — visible only when the
                // filter has a non-empty term. Mirrors the TS chrome.
                if !filter_text.is_empty() {
                    let clear = ui.add(
                        egui::Button::new(egui::RichText::new("✕").color(theme.muted_color))
                            .frame(false),
                    );
                    if clear.clicked() {
                        filter_text.clear();
                    }
                }
            });
        }

        let changed = match custom_changed {
            Some(c) => c,
            None => filter_text != initial,
        };

        if changed {
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
    }

    #[allow(clippy::too_many_arguments)]
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
                // When a custom group renderer is registered, paint
                // the entire row through it (col_index == 0 only —
                // remaining cells are intentionally blank so the
                // layout stays intact). Otherwise fall through to the
                // default renderer which paints across columns.
                let custom_action = if col_index == 0 {
                    if let Some(renderer) = self.group_row_renderer.as_mut() {
                        let collapsed = self
                            .collapsed_groups
                            .get(&group.id)
                            .copied()
                            .unwrap_or(false);
                        let context = GridGroupRowContext {
                            group,
                            options,
                            columns,
                            theme,
                            collapsed,
                        };
                        Some((renderer(ui, &context), collapsed))
                    } else {
                        None
                    }
                } else if self.group_row_renderer.is_some() {
                    // Custom renderer occupies col 0 only — leave
                    // remaining columns blank.
                    Some((GridGroupRowAction::None, false))
                } else {
                    None
                };
                match custom_action {
                    Some((GridGroupRowAction::Toggle, collapsed)) => {
                        let next = !collapsed;
                        self.collapsed_groups.insert(group.id.clone(), next);
                        self.pipeline_dirty = true;
                        self.events.push(EguiGridEvent {
                            kind: EguiGridEventKind::GroupToggled {
                                group_id: group.id.clone(),
                                collapsed: next,
                            },
                        });
                    }
                    Some(_) => {}
                    None => self.draw_group_row(ui, options, columns, theme, group, col_index),
                }
            }
            DisplayItem::Row(row_item) => {
                self.draw_data_row(
                    ui, options, columns, column_ext, row_item, col_index, row_index, theme,
                );
            }
            DisplayItem::Expandable(expandable) => {
                let rect = ui.max_rect();
                ui.painter().rect_filled(rect, 0.0, theme.expandable_bg());

                let bottom = egui::Rect::from_min_size(
                    egui::pos2(rect.min.x, rect.max.y - 1.0),
                    Vec2::new(rect.width(), 1.0),
                );
                ui.painter().rect_filled(bottom, 0.0, theme.border_color);

                if col_index == 0 {
                    ui.add_space(theme.cell_padding_x);
                    if let Some(renderer) = self.expandable_row_renderer.as_mut() {
                        let context = GridExpandableRowContext {
                            row: &expandable.row,
                            options,
                            columns,
                            theme,
                        };
                        renderer(ui, &context);
                    } else {
                        ui.vertical(|ui| {
                            ui.label(
                                egui::RichText::new("Detail View")
                                    .strong()
                                    .size(13.0)
                                    .color(theme.accent),
                            );
                            for col in columns {
                                let value = format_grid_cell_display_value(&expandable.row, col);
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
    }

    /// Paint the empty-state body — either the consumer's renderer or
    /// a default heading + description from `options.labels`. Called
    /// when the pipeline produces no display items.
    fn draw_empty_state_row(&mut self, ui: &mut Ui, options: &GridOptions, theme: &GridTheme) {
        if let Some(renderer) = self.empty_state_renderer.as_mut() {
            let context = GridEmptyStateContext { options, theme };
            renderer(ui, &context);
            return;
        }
        ui.add_space(theme.cell_padding_y);
        ui.vertical_centered(|ui| {
            ui.label(
                egui::RichText::new(&options.labels.empty_heading)
                    .strong()
                    .color(theme.cell_color),
            );
            ui.label(
                egui::RichText::new(&options.labels.empty_description).color(theme.muted_color),
            );
        });
    }

    fn draw_group_row(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        _columns: &[GridColumnDef],
        theme: &GridTheme,
        group: &ui_grid_core::models::GroupItem,
        col_index: usize,
    ) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, theme.group_background);

        let bottom = egui::Rect::from_min_size(
            egui::pos2(rect.min.x, rect.max.y - 1.0),
            Vec2::new(rect.width(), 1.0),
        );
        ui.painter().rect_filled(bottom, 0.0, theme.border_color);

        if col_index == 0 {
            let indent = group.depth as f32 * theme.group_indent_per_depth + theme.cell_padding_x;
            ui.add_space(indent);

            let expand_icon = grid_group_disclosure_icon(group.collapsed, &options.icons);
            let tri_response = icon_button(ui, &expand_icon, theme, theme.cell_color, false);
            tri_response.widget_info(|| {
                WidgetInfo::labeled(
                    WidgetType::Button,
                    ui.is_enabled(),
                    grid_group_disclosure_label(group.collapsed, &options.labels),
                )
            });

            let label = format!("{}: {} ({})", group.field, group.label, group.count);
            let rich = egui::RichText::new(&label).color(theme.cell_color).strong();
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

    #[allow(clippy::too_many_arguments)]
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

        // Synthetic checkbox column — render the per-row checkbox and
        // bail before the regular cell-content path. Editing / focus
        // chrome is suppressed here; selection toggles flow through the
        // shared event helper so the batch / single distinction is
        // preserved.
        if column.name == SELECTION_ROW_HEADER_COL_NAME {
            self.draw_row_selection_checkbox(ui, options, row_item, theme);
            return;
        }

        let rect = ui.max_rect();

        let is_selected = self.selected_row_ids.contains(&row_item.row.id);
        let pin_direction = get_column_pin_direction(&self.pinned_columns, column);
        let bg = if is_selected {
            theme.accent_tint(30)
        } else if pin_direction != PinDirection::None {
            theme.pinned_row_background
        } else if row_index.is_multiple_of(2) {
            theme.row_even
        } else {
            theme.row_odd
        };
        ui.painter().rect_filled(rect, 0.0, bg);

        // Row-edit lifecycle tint. The flags are mutually-exclusive in
        // practice (row state machine: clean → dirty → saving → clean
        // or → error), but priority is error > saving > dirty so a
        // failed save wins the visual. Painted on top of the base row
        // bg so selection / pin tints stay visible underneath.
        let row_edit_tint = if row_item.row.is_error {
            Some(theme.row_error_background)
        } else if row_item.row.is_saving {
            Some(theme.row_saving_background)
        } else if row_item.row.is_dirty {
            Some(theme.row_dirty_background)
        } else {
            None
        };
        if let Some(tint) = row_edit_tint {
            ui.painter().rect_filled(rect, 0.0, tint);
        }

        let bottom = egui::Rect::from_min_size(
            egui::pos2(rect.min.x, rect.max.y - 1.0),
            Vec2::new(rect.width(), 1.0),
        );
        ui.painter().rect_filled(bottom, 0.0, theme.border_color);

        // Hover highlight (paint before content so content draws on top)
        let pointer_hovering =
            ui.input(|i| i.pointer.hover_pos().is_some_and(|pos| rect.contains(pos)));
        if !is_selected && pointer_hovering {
            let hover_bg = if pin_direction == PinDirection::None {
                theme.row_hover
            } else {
                theme.control_hover_background
            };
            ui.painter().rect_filled(rect, 0.0, hover_bg);
        }

        if pin_direction != PinDirection::None {
            let x = if pin_direction == PinDirection::Left {
                rect.min.x
            } else {
                rect.max.x - 2.0
            };
            let pin_indicator =
                egui::Rect::from_min_size(egui::pos2(x, rect.min.y), Vec2::new(2.0, rect.height()));
            ui.painter()
                .rect_filled(pin_indicator, 0.0, theme.pinned_indicator);
        }

        let is_focused = self
            .focused_cell
            .as_ref()
            .is_some_and(|f| f.row_id == row_item.row.id && f.column_name == column.name);

        if is_focused {
            ui.painter().rect_stroke(
                rect.shrink(1.0),
                0.0,
                egui::Stroke::new(2.0, theme.accent),
                egui::StrokeKind::Inside,
            );
        }

        // Validation chrome — red tint + border around invalid cells.
        // The `$$invalid<col>` flag is set on the row entity by the
        // validators; reading it here keeps the chrome a presentation
        // concern with no extra state on the widget.
        let cell_invalid = is_grid_cell_invalid(&row_item.row.entity, column);
        if cell_invalid {
            ui.painter()
                .rect_filled(rect, 0.0, theme.cell_invalid_background);
            ui.painter().rect_stroke(
                rect.shrink(1.0),
                0.0,
                egui::Stroke::new(1.5, theme.cell_invalid_border),
                egui::StrokeKind::Inside,
            );
        }

        // Render cell content
        ui.add_space(theme.cell_padding_x);

        let expand_icon_rect = if col_index == 0 {
            self.draw_row_leading_controls(ui, options, row_item, theme)
        } else {
            None
        };

        let is_editing = self.edit_session.as_ref().is_some_and(|s| {
            s.editing_cell.row_id == row_item.row.id && s.editing_cell.column_name == column.name
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
                // Drag-sense enables drag-paint multi-row selection.
                egui::Sense::click_and_drag(),
            );

            // Validation tooltip — show the joined error messages on
            // hover when the cell is invalid. Mirrors the TS contract
            // wired into vanilla / Angular / React headers.
            if cell_invalid {
                let messages = get_grid_cell_error_messages(
                    &row_item.row.entity,
                    column,
                    &self.validator_registry,
                );
                if !messages.is_empty() {
                    let tooltip = messages.join("\n");
                    response.clone().on_hover_text(&tooltip);
                }
            }

            // Drag-paint multi-row selection. On drag start, anchor on
            // this row; on subsequent drags, recompute the range from
            // anchor → row currently under the pointer. Gated on the
            // grid's row-selection flag so non-selecting consumers
            // never see selection state mutate from a stray drag.
            if options.enable_row_selection.unwrap_or(false) {
                if response.drag_started() {
                    self.drag_paint_anchor = Some(row_item.row.id.clone());
                    let initial = self.selected_row_ids.clone();
                    let batch_events = options.enable_selection_batch_event.unwrap_or(true);
                    self.selected_row_ids = vec![row_item.row.id.clone()];
                    self.last_clicked_row_id = Some(row_item.row.id.clone());
                    self.emit_selection_event(&initial, batch_events);
                } else if response.dragged()
                    && let Some(anchor) = self.drag_paint_anchor.clone()
                {
                    let rows = &self.cached_result.visible_rows;
                    let start = rows.iter().position(|r| r.id == anchor);
                    let end = rows.iter().position(|r| r.id == row_item.row.id);
                    if let (Some(s), Some(e)) = (start, end) {
                        let (from, to) = if s <= e { (s, e) } else { (e, s) };
                        let next: Vec<String> = rows[from..=to]
                            .iter()
                            .filter(|r| r.enable_selection)
                            .map(|r| r.id.clone())
                            .collect();
                        if next != self.selected_row_ids {
                            let initial = self.selected_row_ids.clone();
                            let batch_events = options.enable_selection_batch_event.unwrap_or(true);
                            self.selected_row_ids = next;
                            self.emit_selection_event(&initial, batch_events);
                        }
                    }
                } else if response.drag_stopped() {
                    self.drag_paint_anchor = None;
                }
            }

            if expand_icon_rect.is_some() {
                let toggle_label = if options.enable_tree_view {
                    grid_tree_toggle_label_for_row(
                        &self.expanded_tree_rows,
                        &row_item.row,
                        &options.labels,
                    )
                } else {
                    grid_expand_toggle_label_for_row(&row_item.row, &options.labels)
                };
                response.widget_info(|| {
                    WidgetInfo::labeled(WidgetType::Button, ui.is_enabled(), toggle_label.clone())
                });
            }

            if response.clicked() {
                // Check if the click landed on the expand icon
                let click_pos = ui.input(|i| i.pointer.interact_pos());
                let hit_expand = expand_icon_rect
                    .is_some_and(|icon_rect| click_pos.is_some_and(|pos| icon_rect.contains(pos)));

                if hit_expand {
                    // Toggle expansion and select the row, but don't focus the cell.
                    self.toggle_row_expansion(options, row_item);
                    if options.enable_row_selection.unwrap_or(false) {
                        let initial = self.selected_row_ids.clone();
                        let batch_events = options.enable_selection_batch_event.unwrap_or(true);
                        self.selected_row_ids = vec![row_item.row.id.clone()];
                        self.last_clicked_row_id = Some(row_item.row.id.clone());
                        self.emit_selection_event(&initial, batch_events);
                    }
                } else {
                    // Normal cell click — commit any in-progress edit, select row, focus cell
                    if self.edit_session.is_some() {
                        self.commit_edit(options, columns);
                    }

                    let modifiers = ui.input(|i| RowClickModifiers {
                        shift: i.modifiers.shift,
                        // Treat Ctrl on non-Mac and Cmd on Mac as the
                        // "additive multi-select" modifier — egui exposes
                        // `mac_cmd` for Cmd/Super on Mac and `ctrl` for
                        // the platform-conventional ctrl-key elsewhere.
                        toggle: i.modifiers.command,
                    });
                    self.handle_row_click(options, &row_item.row.id, modifiers);

                    self.focused_cell = Some(GridCellPosition {
                        row_id: row_item.row.id.clone(),
                        column_name: column.name.clone(),
                    });
                }
            }

            if response.double_clicked() {
                // Don't enter edit mode if double-clicking the expand icon
                let click_pos = ui.input(|i| i.pointer.interact_pos());
                let hit_expand = expand_icon_rect
                    .is_some_and(|icon_rect| click_pos.is_some_and(|pos| icon_rect.contains(pos)));

                if !hit_expand {
                    if self.edit_session.is_some() {
                        self.commit_edit(options, columns);
                    }

                    let is_editable = column.enable_cell_edit || options.enable_cell_edit;
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
    }

    /// Draws leading controls (tree indent, expand icon) and returns the expand
    /// icon rect if one was drawn.  The icon is painted passively — click
    /// handling is done by the cell overlay in `draw_data_row`.
    fn draw_row_leading_controls(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        row_item: &RowItem,
        theme: &GridTheme,
    ) -> Option<egui::Rect> {
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
            let icon = grid_tree_toggle_icon(expanded, &options.icons);
            return Some(expand_icon_passive(ui, &icon, theme.accent));
        } else if options.enable_tree_view {
            ui.add_space(24.0);
        }

        if options.enable_expandable && !options.enable_tree_view {
            let expanded = self
                .expanded_rows
                .get(&row_item.row.id)
                .copied()
                .unwrap_or(false);
            let icon = if expanded {
                options.icons.collapse_detail.clone()
            } else {
                options.icons.expand_detail.clone()
            };
            return Some(expand_icon_passive(ui, &icon, theme.accent));
        }

        None
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
            // Consumer-provided editor wins over the built-in choice.
            if let Some(ext) = find_column_ext_mut(column_ext, &column.name)
                && let Some(ref mut editor) = ext.cell_editor
            {
                editor(ui, &mut session.editing_value, theme);
                return;
            }

            // Pick an editor based on the column's declared type. The
            // serialized `editing_value` is always `String`, so each
            // editor parses / formats around that representation.
            match column.r#type {
                ui_grid_core::models::GridColumnType::Boolean => {
                    let mut value = matches!(
                        session.editing_value.as_str(),
                        "true" | "True" | "TRUE" | "1"
                    );
                    if ui.checkbox(&mut value, "").changed() {
                        session.editing_value = value.to_string();
                    }
                }
                ui_grid_core::models::GridColumnType::Date => {
                    // Parse the current `YYYY-MM-DD` string into a jiff
                    // civil date (egui_extras 0.34's DatePickerButton
                    // works with `jiff::civil::Date`); fall back to
                    // today's date when parsing fails so the picker
                    // still opens with a sane initial value.
                    let mut date =
                        jiff::civil::Date::strptime("%Y-%m-%d", session.editing_value.trim())
                            .unwrap_or_else(|_| jiff::Zoned::now().date());
                    let picker = egui_extras::DatePickerButton::new(&mut date)
                        .id_salt("ui_grid_egui_cell_editor_date")
                        .show_icon(true);
                    let response = ui.add(picker);
                    if response.changed() {
                        session.editing_value = date.to_string();
                    }
                }
                ui_grid_core::models::GridColumnType::Number => {
                    // Numeric filter — strip characters that wouldn't
                    // parse as a JSON number while typing. Mirrors the
                    // TS contract where `editor_input_type` returns
                    // `'number'` for these columns.
                    let response = egui::TextEdit::singleline(&mut session.editing_value)
                        .desired_width(ui.available_width() - theme.cell_padding_x * 2.0)
                        .text_color(theme.cell_color)
                        .show(ui)
                        .response;
                    response.request_focus();
                    if response.changed() {
                        session.editing_value.retain(|c| {
                            c.is_ascii_digit() || matches!(c, '-' | '.' | 'e' | 'E' | '+')
                        });
                    }
                }
                _ => {
                    let response = egui::TextEdit::singleline(&mut session.editing_value)
                        .desired_width(ui.available_width() - theme.cell_padding_x * 2.0)
                        .text_color(theme.cell_color)
                        .show(ui)
                        .response;
                    response.request_focus();
                }
            }
        }
    }

    fn toggle_row_expansion(&mut self, options: &GridOptions, row_item: &RowItem) {
        if options.enable_tree_view && row_item.row.has_children {
            let expanded = self
                .expanded_tree_rows
                .get(&row_item.row.id)
                .copied()
                .unwrap_or(false);
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
        } else if options.enable_expandable && !options.enable_tree_view {
            let expanded = self
                .expanded_rows
                .get(&row_item.row.id)
                .copied()
                .unwrap_or(false);
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

    fn handle_row_click(
        &mut self,
        options: &GridOptions,
        row_id: &str,
        modifiers: RowClickModifiers,
    ) {
        // Selection feature flags. Defaults match TS:
        //   enableRowSelection ? false                  (off unless opted in)
        //   modifierKeysToMultiSelect ? false           (Shift / Cmd extend by default)
        //   noUnselect ? false                          (clicks can deselect)
        //   enableSelectionBatchEvent ? true            (multi-row events emit batch)
        if !options.enable_row_selection.unwrap_or(false) {
            return;
        }
        let modifier_keys_to_multi_select = options.modifier_keys_to_multi_select.unwrap_or(false);
        let no_unselect = options.no_unselect.unwrap_or(false);
        let batch_events = options.enable_selection_batch_event.unwrap_or(true);

        // Shift-range extend. When `modifier_keys_to_multi_select` is on
        // the user must hold Shift to extend; that's already what the
        // condition models, so the gate is consistent in both modes.
        let initial = self.selected_row_ids.clone();
        if modifiers.shift
            && let Some(ref last) = self.last_clicked_row_id
        {
            let rows = &self.cached_result.visible_rows;
            let start = rows.iter().position(|r| r.id == *last);
            let end = rows.iter().position(|r| r.id == row_id);
            if let (Some(s), Some(e)) = (start, end) {
                let (from, to) = if s <= e { (s, e) } else { (e, s) };
                self.selected_row_ids = rows[from..=to].iter().map(|r| r.id.clone()).collect();
                self.emit_selection_event(&initial, batch_events);
                return;
            }
        }

        // Cmd/Ctrl additive toggle: leave existing selection alone, just
        // flip this row. When `modifier_keys_to_multi_select` is on, the
        // user MUST hold the modifier to keep multi-row state — without
        // it, additive toggles aren't allowed and the click collapses to
        // single-select.
        let already_selected = self.selected_row_ids.iter().any(|id| id == row_id);
        if modifiers.toggle {
            if already_selected {
                if !no_unselect {
                    self.selected_row_ids.retain(|id| id != row_id);
                }
            } else {
                self.selected_row_ids.push(row_id.to_string());
            }
            self.last_clicked_row_id = Some(row_id.to_string());
            self.emit_selection_event(&initial, batch_events);
            return;
        }

        // Plain click. With `modifier_keys_to_multi_select` set, every
        // unmodified click collapses to single-select. Without it, the
        // legacy behaviour persists: clicking a selected row toggles it
        // off (unless `noUnselect`), clicking a different row replaces
        // the selection with just that row.
        if modifier_keys_to_multi_select {
            self.selected_row_ids = vec![row_id.to_string()];
        } else if already_selected {
            if !no_unselect {
                self.selected_row_ids.retain(|id| id != row_id);
            }
        } else {
            self.selected_row_ids = vec![row_id.to_string()];
        }
        self.last_clicked_row_id = Some(row_id.to_string());
        self.emit_selection_event(&initial, batch_events);
    }

    /// Push the selection-changed event, choosing between the single-row
    /// and batch variants based on the feature flag and the size of the
    /// delta vs. the previous selection. When the change involves more
    /// than one row id (typical for shift-range / Ctrl+A) the batch
    /// variant fires; single-row toggles stay on the legacy event.
    fn emit_selection_event(&mut self, previous: &[String], batch_events: bool) {
        let next = &self.selected_row_ids;
        let same: bool =
            previous.len() == next.len() && previous.iter().all(|id| next.iter().any(|n| n == id));
        if same {
            return;
        }
        let symmetric_delta = previous
            .iter()
            .filter(|id| !next.iter().any(|n| n == *id))
            .count()
            + next
                .iter()
                .filter(|id| !previous.iter().any(|p| p == *id))
                .count();
        let kind = if batch_events && symmetric_delta > 1 {
            EguiGridEventKind::SelectionChangedBatch {
                selected_ids: next.clone(),
            }
        } else {
            EguiGridEventKind::SelectionChanged {
                selected_ids: next.clone(),
            }
        };
        self.events.push(EguiGridEvent { kind });
    }

    fn draw_pagination(
        &mut self,
        ui: &mut Ui,
        options: &GridOptions,
        total_items: usize,
        theme: &GridTheme,
    ) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, theme.header_background);

        let top = egui::Rect::from_min_size(rect.min, Vec2::new(rect.width(), 1.0));
        ui.painter().rect_filled(top, 0.0, theme.border_color);

        let total_pages = get_total_pages_value(options, total_items, self.page_size);
        // Range label "M – N of total" mirrors the vanilla web component's
        // pagination footer; uses inclusive 1-based indices.
        let first_row =
            get_first_row_index_value(options, self.current_page, total_items, self.page_size);
        let last_row =
            get_last_row_index_value(options, self.current_page, total_items, self.page_size);
        let range_label = if total_items == 0 {
            format!("0 {} 0", options.labels.pagination_of)
        } else {
            format!(
                "{} \u{2013} {} {} {}",
                first_row + 1,
                last_row + 1,
                options.labels.pagination_of,
                total_items,
            )
        };
        let page_label = format!(
            "{} {} {} {}",
            options.labels.pagination_page,
            self.current_page,
            options.labels.pagination_of,
            total_pages,
        );

        ui.horizontal(|ui| {
            ui.add_space(theme.cell_padding_x);

            // Render a button whose text colour goes muted when the
            // action is disabled, so prev/next visibly grey out at the
            // edges. The disabled flag still no-ops the click.
            let btn = |ui: &mut Ui, text: &str, label: &str, enabled: bool| -> egui::Response {
                let color = if enabled {
                    theme.accent
                } else {
                    theme.muted_color
                };
                let response = ui.add_enabled(
                    enabled,
                    egui::Label::new(egui::RichText::new(text).color(color))
                        .sense(egui::Sense::click()),
                );
                response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, enabled, label));
                response.on_hover_text(label)
            };

            let can_prev = self.current_page > 1;
            let can_next = self.current_page < total_pages;

            if btn(
                ui,
                "\u{00AB} First",
                &options.labels.pagination_previous,
                can_prev,
            )
            .clicked()
                && can_prev
            {
                self.current_page = 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged { page: 1 },
                });
            }
            if btn(
                ui,
                "\u{2039} Prev",
                &options.labels.pagination_previous,
                can_prev,
            )
            .clicked()
                && can_prev
            {
                self.current_page -= 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }

            let page_response = ui.label(egui::RichText::new(&page_label).color(theme.cell_color));
            page_response.widget_info(|| {
                WidgetInfo::labeled(WidgetType::Label, ui.is_enabled(), &page_label)
            });

            if btn(
                ui,
                "Next \u{203A}",
                &options.labels.pagination_next,
                can_next,
            )
            .clicked()
                && can_next
            {
                self.current_page += 1;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }
            if btn(
                ui,
                "Last \u{00BB}",
                &options.labels.pagination_next,
                can_next,
            )
            .clicked()
                && can_next
            {
                self.current_page = total_pages;
                self.pipeline_dirty = true;
                self.events.push(EguiGridEvent {
                    kind: EguiGridEventKind::PageChanged {
                        page: self.current_page,
                    },
                });
            }

            ui.separator();
            let rows_label_response = ui.label(
                egui::RichText::new(format!("{}:", options.labels.pagination_rows))
                    .color(theme.muted_color),
            );
            let prev_size = self.page_size;
            // Read page-size choices from `options.pagination_page_sizes`
            // (TS contract); fall back to the legacy default tier when
            // the host hasn't supplied any.
            let page_sizes: Vec<usize> = if options.pagination_page_sizes.is_empty() {
                vec![5, 10, 25, 50, 100]
            } else {
                options.pagination_page_sizes.clone()
            };
            let page_size_response = egui::ComboBox::from_id_salt(ui.id().with("page_size"))
                .selected_text(
                    egui::RichText::new(self.page_size.to_string()).color(theme.cell_color),
                )
                .show_ui(ui, |ui| {
                    for size in &page_sizes {
                        ui.selectable_value(&mut self.page_size, *size, size.to_string());
                    }
                });
            page_size_response
                .response
                .labelled_by(rows_label_response.id);
            if self.page_size != prev_size {
                self.current_page = 1;
                self.pipeline_dirty = true;
            }

            ui.separator();
            let range_response =
                ui.label(egui::RichText::new(&range_label).color(theme.muted_color));
            range_response.widget_info(|| {
                WidgetInfo::labeled(WidgetType::Label, ui.is_enabled(), &range_label)
            });
        });
    }
}
