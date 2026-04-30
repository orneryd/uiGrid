use std::collections::BTreeMap;

use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use wasm_bindgen::prelude::*;

use ui_grid_core::{
    display::format_grid_cell_display_value,
    edit::{
        GridMoveDirection, begin_grid_edit_session, build_grid_focus_cell_result,
        clear_grid_edit_session, find_next_grid_cell, is_grid_cell_position, is_printable_grid_key,
        parse_grid_edited_value, should_grid_edit_on_focus, stringify_grid_editor_value,
    },
    export::{export_csv_rows, header_label},
    filtering::{clear_grid_filter_reasons, matches_grid_row_filters},
    grouping::build_grid_display_items,
    identity::{build_grid_sort_state, find_grid_row_by_id, resolve_grid_row_id},
    infinite_scroll::{
        MaybeRequestInfiniteScrollDataContext, complete_infinite_scroll_data_load,
        maybe_request_infinite_scroll_data, reset_infinite_scroll_state,
        save_infinite_scroll_percentage, set_infinite_scroll_directions_state,
    },
    models::{
        BuildGridPipelineContext, GridCellPosition, GridColumnDef, GridLabels, GridOptions,
        GridRecord, GridRow, SortState,
    },
    pagination::{
        get_current_page_value, get_effective_page_size, get_first_row_index_value,
        get_last_row_index_value, get_total_pages_value, is_virtualization_enabled,
        paginate_grid_rows, resolve_grid_page_size, seek_grid_page,
    },
    pinning::{
        PinDirection, PinnedColumnState, build_initial_pinned_state, compute_pinned_offset,
        get_column_pin_direction, is_column_pinnable, is_pinning_enabled, pin_column_state,
        pinning_button_label,
    },
    pipeline::build_grid_pipeline,
    row_state::{
        add_grid_row_invisible_reason, are_all_grid_rows_expanded, clear_grid_row_invisible_reason,
        expand_all_grid_rows, expand_all_grid_tree_rows, get_grid_tree_row_children,
        set_grid_tree_row_expanded, toggle_grid_row_expanded, toggle_grid_tree_row_expanded,
    },
    sorting::sort_grid_rows,
    state::{
        BuildGridSavedStateContext, build_grid_saved_state, is_safe_state_key,
        normalize_boolean_map, normalize_grid_saved_state, sanitize_download_filename,
    },
    tree::{build_grid_rows, filter_and_flatten_grid_tree_rows, is_tree_enabled},
    utils::{get_cell_value, get_path_value, stringify_cell_value, titleize},
    viewmodel::{
        can_grid_expand_rows, can_grid_move_columns, grid_cell_indent, grid_column_width,
        grid_editor_input_type, grid_expand_toggle_label, grid_expand_toggle_label_for_row,
        grid_filter_placeholder, grid_group_disclosure_label, grid_grouping_button_label,
        grid_sort_aria_sort, grid_sort_button_label, grid_tree_toggle_label,
        grid_tree_toggle_label_for_row, is_grid_column_filterable, is_grid_column_grouped,
        is_grid_column_sortable, is_grid_filtering_enabled, is_grid_grouping_enabled,
        is_grid_infinite_scroll_enabled, is_grid_pagination_enabled, is_grid_primary_column,
        is_grid_sorting_enabled, is_grid_tree_enabled, is_grid_tree_row_expanded,
        resolve_grid_labels, should_show_grid_expand_toggle, should_show_grid_pagination_controls,
        should_show_grid_tree_toggle,
    },
};
use ui_grid_virtualization::{VirtualWindowRequest, calculate_virtual_window};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptionsColumnInput {
    options: GridOptions,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisibleColumnsColumnInput {
    visible_columns: Vec<GridColumnDef>,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptionsVisibleColumnsRowColumnInput {
    options: GridOptions,
    visible_columns: Vec<GridColumnDef>,
    row: GridRow,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptionsVisibleColumnsColumnInput {
    options: GridOptions,
    visible_columns: Vec<GridColumnDef>,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DirectionLabelsInput {
    direction: ui_grid_core::constants::SortDirection,
    labels: GridLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BooleanLabelsInput {
    value: bool,
    labels: GridLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupByColumnInput {
    group_by_columns: Vec<String>,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandedTreeRowsRowInput {
    expanded_tree_rows: BTreeMap<String, bool>,
    row: GridRow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandedTreeRowsRowLabelsInput {
    expanded_tree_rows: BTreeMap<String, bool>,
    row: GridRow,
    labels: GridLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RowLabelsInput {
    row: GridRow,
    labels: GridLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PinnedColumnsColumnInput {
    pinned_columns: PinnedColumnState,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PinColumnStateInput {
    current: PinnedColumnState,
    column_name: String,
    direction: PinDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisibleColumnsPinnedColumnsColumnInput {
    visible_columns: Vec<GridColumnDef>,
    pinned_columns: PinnedColumnState,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PinnedColumnsColumnLabelsInput {
    pinned_columns: PinnedColumnState,
    column: GridColumnDef,
    labels: GridLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CellPositionMatchInput {
    position: Option<GridCellPosition>,
    row_id: String,
    column_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BeginEditSessionInput {
    row_id: String,
    column_name: String,
    editing_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridFocusCellResultInput {
    current_focused_cell: Option<GridCellPosition>,
    current_editing_cell: Option<GridCellPosition>,
    row_id: String,
    column_name: String,
    should_edit_on_focus: bool,
    is_cell_editable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FindNextGridCellInput {
    rows: Vec<GridRow>,
    columns: Vec<GridColumnDef>,
    row_id: String,
    column_name: String,
    direction: GridMoveDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParseGridEditedValueInput {
    column: GridColumnDef,
    value: String,
    old_value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintableGridKeyInput {
    key: String,
    ctrl_key: bool,
    meta_key: bool,
    alt_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InfiniteScrollLoadInput {
    state: ui_grid_core::models::GridInfiniteScrollState,
    scroll_up: bool,
    scroll_down: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InfiniteScrollVisibleRowsInput {
    state: ui_grid_core::models::GridInfiniteScrollState,
    visible_rows: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InfiniteScrollDirectionsInput {
    state: ui_grid_core::models::GridInfiniteScrollState,
    scroll_up: bool,
    scroll_down: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandedRowsRowIdInput {
    expanded_rows: BTreeMap<String, bool>,
    row_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandedTreeRowsRowIdExpandedInput {
    expanded_tree_rows: BTreeMap<String, bool>,
    row_id: String,
    expanded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RowsExpandedRowsInput {
    rows: Vec<GridRow>,
    expanded_rows: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HiddenRowReasonInput {
    hidden_row_reasons: BTreeMap<String, Vec<String>>,
    row_id: String,
    reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaginationInput {
    options: GridOptions,
    page_size: usize,
    total_items: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaginationPageInput {
    options: GridOptions,
    current_page: usize,
    total_items: usize,
    page_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaginateRowsInput {
    rows: Vec<GridRow>,
    options: GridOptions,
    current_page: usize,
    page_size: usize,
    total_items: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VirtualizationInput {
    options: GridOptions,
    item_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeekGridPageInput {
    page: usize,
    total_pages: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SortRowsInput {
    rows: Vec<GridRow>,
    columns: Vec<GridColumnDef>,
    options: GridOptions,
    sort_state: SortState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FindGridRowByIdInput {
    rows: Vec<GridRow>,
    row_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridSortStateInput {
    column_name: String,
    direction: Option<ui_grid_core::constants::SortDirection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveGridRowIdInput {
    options: GridOptions,
    row: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormatGridCellDisplayValueInput {
    row: GridRow,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeaderLabelInput {
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchesGridRowFiltersInput {
    row: GridRow,
    columns: Vec<GridColumnDef>,
    options: GridOptions,
    active_filters: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchesGridRowFiltersResult {
    row: GridRow,
    matches: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridRowsInput {
    options: GridOptions,
    row_size: usize,
    hidden_row_reasons: BTreeMap<String, Vec<String>>,
    expanded_rows: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilterFlattenTreeRowsInput {
    rows: Vec<GridRow>,
    columns: Vec<GridColumnDef>,
    options: GridOptions,
    active_filters: BTreeMap<String, String>,
    expanded_tree_rows: BTreeMap<String, bool>,
    sort_state: SortState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathValueInput {
    record: GridRecord,
    path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CellValueInput {
    row: GridRecord,
    column: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StringifyCellValueInput {
    value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TitleizeInput {
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridDisplayItemsInput {
    rows: Vec<GridRow>,
    columns: Vec<GridColumnDef>,
    options: GridOptions,
    group_by: Vec<String>,
    collapsed_groups: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NormalizeBooleanMapInput {
    value: serde_json::Map<String, Value>,
}

fn from_js<T: DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("failed to decode wasm input: {error}")))
}

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    value
        .serialize(&serializer)
        .map_err(|error| JsValue::from_str(&format!("failed to encode wasm output: {error}")))
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Pipeline

#[wasm_bindgen]
pub fn build_pipeline_js(context: JsValue) -> Result<JsValue, JsValue> {
    let context: BuildGridPipelineContext = from_js(context)?;
    let result = build_grid_pipeline(&context);
    to_js(&result)
}

#[wasm_bindgen]
pub fn build_grid_pipeline_js(context: JsValue) -> Result<JsValue, JsValue> {
    build_pipeline_js(context)
}

// Viewmodel

#[wasm_bindgen]
pub fn resolve_grid_labels_js(overrides: JsValue) -> Result<JsValue, JsValue> {
    if overrides.is_null() || overrides.is_undefined() {
        return to_js(&resolve_grid_labels(None));
    }

    let overrides: GridLabels = from_js(overrides)?;
    to_js(&resolve_grid_labels(Some(&overrides)))
}

#[wasm_bindgen]
pub fn is_grid_tree_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_tree_enabled(&options))
}

#[wasm_bindgen]
pub fn is_grid_grouping_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_grouping_enabled(&options))
}

#[wasm_bindgen]
pub fn can_grid_expand_rows_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(can_grid_expand_rows(&options))
}

#[wasm_bindgen]
pub fn is_grid_pagination_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_pagination_enabled(&options))
}

#[wasm_bindgen]
pub fn should_show_grid_pagination_controls_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(should_show_grid_pagination_controls(&options))
}

#[wasm_bindgen]
pub fn is_grid_infinite_scroll_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_infinite_scroll_enabled(&options))
}

#[wasm_bindgen]
pub fn is_grid_sorting_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_sorting_enabled(&options))
}

#[wasm_bindgen]
pub fn is_grid_filtering_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_grid_filtering_enabled(&options))
}

#[wasm_bindgen]
pub fn can_grid_move_columns_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(can_grid_move_columns(&options))
}

#[wasm_bindgen]
pub fn is_grid_primary_column_js(input: JsValue) -> Result<bool, JsValue> {
    let input: VisibleColumnsColumnInput = from_js(input)?;
    Ok(is_grid_primary_column(
        &input.visible_columns,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn is_grid_column_sortable_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsColumnInput = from_js(input)?;
    Ok(is_grid_column_sortable(&input.options, &input.column))
}

#[wasm_bindgen]
pub fn is_grid_column_filterable_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsColumnInput = from_js(input)?;
    Ok(is_grid_column_filterable(&input.options, &input.column))
}

#[wasm_bindgen]
pub fn should_show_grid_tree_toggle_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsVisibleColumnsRowColumnInput = from_js(input)?;
    Ok(should_show_grid_tree_toggle(
        &input.options,
        &input.visible_columns,
        &input.row,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn should_show_grid_expand_toggle_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsVisibleColumnsColumnInput = from_js(input)?;
    Ok(should_show_grid_expand_toggle(
        &input.options,
        &input.visible_columns,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn grid_sort_button_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: DirectionLabelsInput = from_js(input)?;
    Ok(grid_sort_button_label(input.direction, &input.labels))
}

#[wasm_bindgen]
pub fn grid_sort_aria_sort_js(direction: JsValue) -> Result<String, JsValue> {
    let direction: ui_grid_core::constants::SortDirection = from_js(direction)?;
    Ok(grid_sort_aria_sort(direction))
}

#[wasm_bindgen]
pub fn grid_grouping_button_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: BooleanLabelsInput = from_js(input)?;
    Ok(grid_grouping_button_label(input.value, &input.labels))
}

#[wasm_bindgen]
pub fn grid_filter_placeholder_js(input: JsValue) -> Result<String, JsValue> {
    let input: BooleanLabelsInput = from_js(input)?;
    Ok(grid_filter_placeholder(input.value, &input.labels))
}

#[wasm_bindgen]
pub fn grid_group_disclosure_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: BooleanLabelsInput = from_js(input)?;
    Ok(grid_group_disclosure_label(input.value, &input.labels))
}

#[wasm_bindgen]
pub fn grid_editor_input_type_js(column: JsValue) -> Result<String, JsValue> {
    let column: GridColumnDef = from_js(column)?;
    Ok(grid_editor_input_type(&column))
}

#[wasm_bindgen]
pub fn grid_column_width_js(column: JsValue) -> Result<String, JsValue> {
    let column: GridColumnDef = from_js(column)?;
    Ok(grid_column_width(&column))
}

#[wasm_bindgen]
pub fn grid_cell_indent_js(input: JsValue) -> Result<String, JsValue> {
    let input: OptionsVisibleColumnsRowColumnInput = from_js(input)?;
    Ok(grid_cell_indent(
        &input.options,
        &input.visible_columns,
        &input.row,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn grid_tree_toggle_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: BooleanLabelsInput = from_js(input)?;
    Ok(grid_tree_toggle_label(input.value, &input.labels))
}

#[wasm_bindgen]
pub fn grid_expand_toggle_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: BooleanLabelsInput = from_js(input)?;
    Ok(grid_expand_toggle_label(input.value, &input.labels))
}

#[wasm_bindgen]
pub fn is_grid_column_grouped_js(input: JsValue) -> Result<bool, JsValue> {
    let input: GroupByColumnInput = from_js(input)?;
    Ok(is_grid_column_grouped(
        &input.group_by_columns,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn is_grid_tree_row_expanded_js(input: JsValue) -> Result<bool, JsValue> {
    let input: ExpandedTreeRowsRowInput = from_js(input)?;
    Ok(is_grid_tree_row_expanded(
        &input.expanded_tree_rows,
        &input.row,
    ))
}

#[wasm_bindgen]
pub fn grid_tree_toggle_label_for_row_js(input: JsValue) -> Result<String, JsValue> {
    let input: ExpandedTreeRowsRowLabelsInput = from_js(input)?;
    Ok(grid_tree_toggle_label_for_row(
        &input.expanded_tree_rows,
        &input.row,
        &input.labels,
    ))
}

#[wasm_bindgen]
pub fn grid_expand_toggle_label_for_row_js(input: JsValue) -> Result<String, JsValue> {
    let input: RowLabelsInput = from_js(input)?;
    Ok(grid_expand_toggle_label_for_row(&input.row, &input.labels))
}

// Pinning

#[wasm_bindgen]
pub fn is_pinning_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_pinning_enabled(&options))
}

#[wasm_bindgen]
pub fn is_column_pinnable_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsColumnInput = from_js(input)?;
    Ok(is_column_pinnable(&input.options, &input.column))
}

#[wasm_bindgen]
pub fn get_column_pin_direction_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: PinnedColumnsColumnInput = from_js(input)?;
    to_js(&get_column_pin_direction(
        &input.pinned_columns,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn pin_column_state_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: PinColumnStateInput = from_js(input)?;
    to_js(&pin_column_state(
        &input.current,
        &input.column_name,
        input.direction,
    ))
}

#[wasm_bindgen]
pub fn build_initial_pinned_state_js(columns: JsValue) -> Result<JsValue, JsValue> {
    let columns: Vec<GridColumnDef> = from_js(columns)?;
    to_js(&build_initial_pinned_state(&columns))
}

#[wasm_bindgen]
pub fn compute_pinned_offset_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: VisibleColumnsPinnedColumnsColumnInput = from_js(input)?;
    to_js(&compute_pinned_offset(
        &input.visible_columns,
        &input.pinned_columns,
        &input.column,
    ))
}

#[wasm_bindgen]
pub fn pinning_button_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: PinnedColumnsColumnLabelsInput = from_js(input)?;
    Ok(pinning_button_label(
        &input.pinned_columns,
        &input.column,
        &input.labels,
    ))
}

// Edit

#[wasm_bindgen]
pub fn is_grid_cell_position_js(input: JsValue) -> Result<bool, JsValue> {
    let input: CellPositionMatchInput = from_js(input)?;
    Ok(is_grid_cell_position(
        input.position.as_ref(),
        &input.row_id,
        &input.column_name,
    ))
}

#[wasm_bindgen]
pub fn begin_grid_edit_session_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BeginEditSessionInput = from_js(input)?;
    to_js(&begin_grid_edit_session(
        input.row_id,
        input.column_name,
        input.editing_value,
    ))
}

#[wasm_bindgen]
pub fn should_grid_edit_on_focus_js(input: JsValue) -> Result<bool, JsValue> {
    let input: OptionsColumnInput = from_js(input)?;
    Ok(should_grid_edit_on_focus(&input.options, &input.column))
}

#[wasm_bindgen]
pub fn build_grid_focus_cell_result_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridFocusCellResultInput = from_js(input)?;
    to_js(&build_grid_focus_cell_result(
        input.current_focused_cell.as_ref(),
        input.current_editing_cell.as_ref(),
        input.row_id,
        input.column_name,
        input.should_edit_on_focus,
        input.is_cell_editable,
    ))
}

#[wasm_bindgen]
pub fn clear_grid_edit_session_js() -> Result<JsValue, JsValue> {
    to_js(&clear_grid_edit_session())
}

#[wasm_bindgen]
pub fn find_next_grid_cell_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FindNextGridCellInput = from_js(input)?;
    to_js(
        &find_next_grid_cell::<fn(&GridRow, &GridColumnDef) -> bool>(
            &input.rows,
            &input.columns,
            &input.row_id,
            &input.column_name,
            input.direction,
            None,
        ),
    )
}

#[wasm_bindgen]
pub fn stringify_grid_editor_value_js(value: JsValue) -> Result<String, JsValue> {
    let value: Value = from_js(value)?;
    Ok(stringify_grid_editor_value(&value))
}

#[wasm_bindgen]
pub fn parse_grid_edited_value_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ParseGridEditedValueInput = from_js(input)?;
    to_js(&parse_grid_edited_value(
        &input.column,
        &input.value,
        &input.old_value,
    ))
}

#[wasm_bindgen]
pub fn is_printable_grid_key_js(input: JsValue) -> Result<bool, JsValue> {
    let input: PrintableGridKeyInput = from_js(input)?;
    Ok(is_printable_grid_key(
        &input.key,
        input.ctrl_key,
        input.meta_key,
        input.alt_key,
    ))
}

// Row state

#[wasm_bindgen]
pub fn toggle_grid_row_expanded_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ExpandedRowsRowIdInput = from_js(input)?;
    to_js(&toggle_grid_row_expanded(
        &input.expanded_rows,
        &input.row_id,
    ))
}

#[wasm_bindgen]
pub fn expand_all_grid_rows_js(rows: JsValue) -> Result<JsValue, JsValue> {
    let rows: Vec<GridRow> = from_js(rows)?;
    to_js(&expand_all_grid_rows(&rows))
}

#[wasm_bindgen]
pub fn are_all_grid_rows_expanded_js(input: JsValue) -> Result<bool, JsValue> {
    let input: RowsExpandedRowsInput = from_js(input)?;
    Ok(are_all_grid_rows_expanded(
        &input.rows,
        &input.expanded_rows,
    ))
}

#[wasm_bindgen]
pub fn set_grid_tree_row_expanded_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ExpandedTreeRowsRowIdExpandedInput = from_js(input)?;
    to_js(&set_grid_tree_row_expanded(
        &input.expanded_tree_rows,
        &input.row_id,
        input.expanded,
    ))
}

#[wasm_bindgen]
pub fn toggle_grid_tree_row_expanded_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ExpandedRowsRowIdInput = from_js(input)?;
    to_js(&toggle_grid_tree_row_expanded(
        &input.expanded_rows,
        &input.row_id,
    ))
}

#[wasm_bindgen]
pub fn expand_all_grid_tree_rows_js(rows: JsValue) -> Result<JsValue, JsValue> {
    let rows: Vec<GridRow> = from_js(rows)?;
    to_js(&expand_all_grid_tree_rows(&rows))
}

#[wasm_bindgen]
pub fn get_grid_tree_row_children_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FindGridRowByIdInput = from_js(input)?;
    to_js(&get_grid_tree_row_children(&input.rows, &input.row_id))
}

#[wasm_bindgen]
pub fn add_grid_row_invisible_reason_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: HiddenRowReasonInput = from_js(input)?;
    to_js(&add_grid_row_invisible_reason(
        &input.hidden_row_reasons,
        &input.row_id,
        &input.reason,
    ))
}

#[wasm_bindgen]
pub fn clear_grid_row_invisible_reason_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: HiddenRowReasonInput = from_js(input)?;
    to_js(&clear_grid_row_invisible_reason(
        &input.hidden_row_reasons,
        &input.row_id,
        &input.reason,
    ))
}

// Pagination

#[wasm_bindgen]
pub fn get_effective_page_size_js(input: JsValue) -> Result<usize, JsValue> {
    let input: PaginationInput = from_js(input)?;
    Ok(get_effective_page_size(
        &input.options,
        input.page_size,
        input.total_items,
    ))
}

#[wasm_bindgen]
pub fn get_total_pages_value_js(input: JsValue) -> Result<usize, JsValue> {
    let input: PaginationInput = from_js(input)?;
    Ok(get_total_pages_value(
        &input.options,
        input.total_items,
        input.page_size,
    ))
}

#[wasm_bindgen]
pub fn get_current_page_value_js(input: JsValue) -> Result<usize, JsValue> {
    let input: PaginationPageInput = from_js(input)?;
    Ok(get_current_page_value(
        &input.options,
        input.current_page,
        input.total_items,
        input.page_size,
    ))
}

#[wasm_bindgen]
pub fn get_first_row_index_value_js(input: JsValue) -> Result<usize, JsValue> {
    let input: PaginationPageInput = from_js(input)?;
    Ok(get_first_row_index_value(
        &input.options,
        input.current_page,
        input.total_items,
        input.page_size,
    ))
}

#[wasm_bindgen]
pub fn get_last_row_index_value_js(input: JsValue) -> Result<usize, JsValue> {
    let input: PaginationPageInput = from_js(input)?;
    Ok(get_last_row_index_value(
        &input.options,
        input.current_page,
        input.total_items,
        input.page_size,
    ))
}

#[wasm_bindgen]
pub fn paginate_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: PaginateRowsInput = from_js(input)?;
    to_js(&paginate_grid_rows(
        &input.rows,
        &input.options,
        input.current_page,
        input.page_size,
        input.total_items,
    ))
}

#[wasm_bindgen]
pub fn is_virtualization_enabled_js(input: JsValue) -> Result<bool, JsValue> {
    let input: VirtualizationInput = from_js(input)?;
    Ok(is_virtualization_enabled(&input.options, input.item_count))
}

#[wasm_bindgen]
pub fn seek_grid_page_js(input: JsValue) -> Result<usize, JsValue> {
    let input: SeekGridPageInput = from_js(input)?;
    Ok(seek_grid_page(input.page, input.total_pages))
}

#[wasm_bindgen]
pub fn resolve_grid_page_size_js(page_size: usize) -> Result<JsValue, JsValue> {
    to_js(&resolve_grid_page_size(page_size))
}

// State

#[wasm_bindgen]
pub fn export_csv_rows_js(columns: JsValue, rows: JsValue) -> Result<String, JsValue> {
    let columns: Vec<GridColumnDef> = from_js(columns)?;
    let rows: Vec<GridRow> = from_js(rows)?;
    Ok(export_csv_rows(&columns, &rows))
}

#[wasm_bindgen]
pub fn build_saved_state_js(context: JsValue) -> Result<JsValue, JsValue> {
    let context: BuildGridSavedStateContext = from_js(context)?;
    let result = build_grid_saved_state(context);
    to_js(&result)
}

#[wasm_bindgen]
pub fn build_grid_saved_state_js(context: JsValue) -> Result<JsValue, JsValue> {
    build_saved_state_js(context)
}

#[wasm_bindgen]
pub fn normalize_saved_state_js(state: JsValue) -> Result<JsValue, JsValue> {
    let state: serde_json::Value = from_js(state)?;
    let result = normalize_grid_saved_state(&state);
    to_js(&result)
}

#[wasm_bindgen]
pub fn normalize_grid_saved_state_js(state: JsValue) -> Result<JsValue, JsValue> {
    normalize_saved_state_js(state)
}

#[wasm_bindgen]
pub fn sanitize_download_filename_js(value: String) -> String {
    sanitize_download_filename(&value)
}

#[wasm_bindgen]
pub fn normalize_boolean_map_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: NormalizeBooleanMapInput = from_js(input)?;
    to_js(&normalize_boolean_map(&input.value))
}

#[wasm_bindgen]
pub fn is_safe_state_key_js(value: String) -> bool {
    is_safe_state_key(&value)
}

// Identity

#[wasm_bindgen]
pub fn find_grid_row_by_id_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FindGridRowByIdInput = from_js(input)?;
    to_js(&find_grid_row_by_id(&input.rows, &input.row_id))
}

#[wasm_bindgen]
pub fn build_grid_sort_state_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridSortStateInput = from_js(input)?;
    to_js(&build_grid_sort_state(input.column_name, input.direction))
}

#[wasm_bindgen]
pub fn resolve_grid_row_id_js(input: JsValue) -> Result<String, JsValue> {
    let input: ResolveGridRowIdInput = from_js(input)?;
    Ok(resolve_grid_row_id(&input.options, &input.row))
}

// Infinite scroll

#[wasm_bindgen]
pub fn maybe_request_infinite_scroll_data_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: MaybeRequestInfiniteScrollDataContext = from_js(input)?;
    to_js(&maybe_request_infinite_scroll_data(&input))
}

#[wasm_bindgen]
pub fn complete_infinite_scroll_data_load_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: InfiniteScrollLoadInput = from_js(input)?;
    to_js(&complete_infinite_scroll_data_load(
        &input.state,
        input.scroll_up,
        input.scroll_down,
    ))
}

#[wasm_bindgen]
pub fn reset_infinite_scroll_state_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: InfiniteScrollDirectionsInput = from_js(input)?;
    to_js(&reset_infinite_scroll_state(
        input.scroll_up,
        input.scroll_down,
    ))
}

#[wasm_bindgen]
pub fn save_infinite_scroll_percentage_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: InfiniteScrollVisibleRowsInput = from_js(input)?;
    to_js(&save_infinite_scroll_percentage(
        &input.state,
        input.visible_rows,
    ))
}

#[wasm_bindgen]
pub fn set_infinite_scroll_directions_state_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: InfiniteScrollDirectionsInput = from_js(input)?;
    to_js(&set_infinite_scroll_directions_state(
        &input.state,
        input.scroll_up,
        input.scroll_down,
    ))
}

// Display/export/filter/sort/tree/utils/grouping

#[wasm_bindgen]
pub fn format_grid_cell_display_value_js(input: JsValue) -> Result<String, JsValue> {
    let input: FormatGridCellDisplayValueInput = from_js(input)?;
    Ok(format_grid_cell_display_value(&input.row, &input.column))
}

#[wasm_bindgen]
pub fn header_label_js(input: JsValue) -> Result<String, JsValue> {
    let input: HeaderLabelInput = from_js(input)?;
    Ok(header_label(&input.column))
}

#[wasm_bindgen]
pub fn clear_grid_filter_reasons_js(row: JsValue) -> Result<JsValue, JsValue> {
    let mut row: GridRow = from_js(row)?;
    clear_grid_filter_reasons(&mut row);
    to_js(&row)
}

#[wasm_bindgen]
pub fn matches_grid_row_filters_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: MatchesGridRowFiltersInput = from_js(input)?;
    let matches = matches_grid_row_filters(
        &mut input.row,
        &input.columns,
        &input.options,
        &input.active_filters,
    );
    to_js(&MatchesGridRowFiltersResult {
        row: input.row,
        matches,
    })
}

#[wasm_bindgen]
pub fn sort_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: SortRowsInput = from_js(input)?;
    to_js(&sort_grid_rows(
        &input.rows,
        &input.columns,
        &input.options,
        &input.sort_state,
    ))
}

#[wasm_bindgen]
pub fn build_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridRowsInput = from_js(input)?;
    to_js(&build_grid_rows(
        &input.options,
        input.row_size,
        &input.hidden_row_reasons,
        &input.expanded_rows,
    ))
}

#[wasm_bindgen]
pub fn is_tree_enabled_js(options: JsValue) -> Result<bool, JsValue> {
    let options: GridOptions = from_js(options)?;
    Ok(is_tree_enabled(&options))
}

#[wasm_bindgen]
pub fn filter_and_flatten_grid_tree_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FilterFlattenTreeRowsInput = from_js(input)?;
    to_js(&filter_and_flatten_grid_tree_rows(
        &input.rows,
        &input.columns,
        &input.options,
        &input.active_filters,
        &input.expanded_tree_rows,
        &input.sort_state,
    ))
}

#[wasm_bindgen]
pub fn get_path_value_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: PathValueInput = from_js(input)?;
    to_js(&get_path_value(&input.record, &input.path))
}

#[wasm_bindgen]
pub fn get_cell_value_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: CellValueInput = from_js(input)?;
    to_js(&get_cell_value(&input.row, &input.column))
}

#[wasm_bindgen]
pub fn stringify_cell_value_js(input: JsValue) -> Result<String, JsValue> {
    let input: StringifyCellValueInput = from_js(input)?;
    Ok(stringify_cell_value(&input.value))
}

#[wasm_bindgen]
pub fn titleize_js(input: JsValue) -> Result<String, JsValue> {
    let input: TitleizeInput = from_js(input)?;
    Ok(titleize(&input.value))
}

#[wasm_bindgen]
pub fn build_grid_display_items_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridDisplayItemsInput = from_js(input)?;
    to_js(&build_grid_display_items(
        &input.rows,
        &input.columns,
        &input.options,
        &input.group_by,
        &input.collapsed_groups,
    ))
}

// Virtualization

#[wasm_bindgen]
pub fn calculate_virtual_window_js(request: JsValue) -> Result<JsValue, JsValue> {
    let request: VirtualWindowRequest = from_js(request)?;
    let result = calculate_virtual_window(&request);
    to_js(&result)
}
