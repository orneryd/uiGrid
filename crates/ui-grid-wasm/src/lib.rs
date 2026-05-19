use std::{cell::RefCell, collections::BTreeMap};

use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Map, Value};
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;

use ui_grid_core::{
    display::format_grid_cell_display_value,
    edit::{
        GridMoveDirection, begin_grid_edit_session, build_grid_focus_cell_result,
        clear_grid_edit_session, find_next_grid_cell, is_grid_cell_position, is_printable_grid_key,
        parse_grid_edited_value, should_grid_edit_on_focus, stringify_grid_editor_value,
    },
    export::{
        GridExporterColumnType, GridExporterRowType, GridHeaderTemplateContext, build_grid_csv,
        build_grid_excel_sheet_data, build_grid_header_context, build_grid_pdf_doc_definition,
        calculate_grid_pdf_column_widths, export_csv_rows, filter_exporter_columns,
        format_grid_excel_field, format_grid_header_display_value, format_grid_pdf_field,
        header_label, resolve_exporter_filename, resolve_grid_exporter_excel_options,
        resolve_grid_exporter_options, resolve_grid_exporter_pdf_options,
    },
    filtering::{
        clear_grid_filter_reasons, matches_grid_row_filters, matches_grid_row_prepared_filters,
        prepare_grid_column_filters,
    },
    grouping::build_grid_display_items,
    i18n::{
        GridI18nService, add_grid_i18n_locale, create_grid_i18n_service,
        get_grid_i18n_current_labels, get_grid_i18n_current_lang, get_grid_i18n_labels,
        get_grid_i18n_supported_languages, resolve_labels_from_i18n, set_grid_i18n_current_lang,
    },
    identity::{build_grid_sort_state, find_grid_row_by_id, resolve_grid_row_id},
    importer::{
        build_grid_importer_objects_from_csv, build_grid_importer_objects_from_json,
        default_grid_importer_process_headers, flatten_grid_column_defs_for_import,
        parse_grid_importer_csv, parse_grid_importer_json, resolve_grid_importer_options,
    },
    infinite_scroll::{
        MaybeRequestInfiniteScrollDataContext, complete_infinite_scroll_data_load,
        maybe_request_infinite_scroll_data, reset_infinite_scroll_state,
        save_infinite_scroll_percentage, set_infinite_scroll_directions_state,
    },
    menu::{
        GridExporterMenuContext, GridRowEditMenuPredicates, build_grid_exporter_menu_items,
        build_grid_importer_menu_items, build_grid_row_edit_menu_items,
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
    pipeline::{
        build_grid_pipeline, clear_grid_pipeline_rows_cache, get_cached_grid_pipeline_rows,
    },
    row_edit::{
        GridRowEditState, collect_grid_row_entities, create_grid_row_edit_state,
        is_grid_row_edit_timer_enabled, mark_grid_row_clean, mark_grid_row_dirty,
        mark_grid_row_error, mark_grid_row_saving, resolve_grid_row_edit_wait_interval,
    },
    row_searcher::{
        ParsedCondition, build_wildcard_pattern, get_term, run_column_filter, setup_filters,
    },
    row_sorter::{SortKind, compare_values, guess_sort_kind},
    row_state::{
        add_grid_row_invisible_reason, are_all_grid_rows_expanded, clear_grid_row_invisible_reason,
        expand_all_grid_rows, expand_all_grid_tree_rows, get_grid_tree_row_children,
        set_grid_tree_row_expanded, toggle_grid_row_expanded, toggle_grid_tree_row_expanded,
    },
    selection::{
        GridSelectionState, SelectAllGridRowsOptions, ShiftGridRowSelectionOptions,
        ToggleGridRowSelectionOptions, clear_all_grid_selection, create_grid_selection_state,
        find_grid_row_by_key, map_selected_rows_to_entities, reconcile_grid_selection,
        resolve_grid_selection_options, select_all_grid_rows, select_all_visible_grid_rows,
        shift_grid_row_selection, toggle_grid_row_selection,
    },
    sorting::sort_grid_rows,
    state::{
        BuildGridSavedStateContext, build_grid_saved_state, is_safe_state_key,
        normalize_boolean_map, normalize_grid_saved_state, sanitize_download_filename,
    },
    template::{interpolate_grid_template, resolve_grid_template_value},
    tree::{build_grid_rows, filter_and_flatten_grid_tree_rows, is_tree_enabled},
    utils::{get_cell_value, get_path_value, stringify_cell_value, titleize},
    validate::{
        GridValidatorRegistry, HostValidatorMarker, clear_grid_cell_error,
        create_grid_validator_registry, errors_field_for, get_grid_cell_error_messages,
        get_grid_cell_error_names, invalid_field_for, is_grid_cell_invalid,
        run_grid_cell_validators, set_grid_cell_error, set_grid_cell_invalid, set_grid_cell_valid,
        validate_all_grid_rows,
    },
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
struct ResolveGridLabelsInput {
    current_labels: GridLabels,
    #[serde(default)]
    overrides: Option<Map<String, Value>>,
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
struct PipelineStaticContext {
    options: GridOptions,
    columns: Vec<GridColumnDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineDynamicContext {
    #[serde(default)]
    active_filters: BTreeMap<String, String>,
    #[serde(default)]
    sort_state: SortState,
    #[serde(default)]
    group_by_columns: Vec<String>,
    #[serde(default)]
    collapsed_groups: BTreeMap<String, bool>,
    #[serde(default)]
    hidden_row_reasons: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    expanded_rows: BTreeMap<String, bool>,
    #[serde(default)]
    expanded_tree_rows: BTreeMap<String, bool>,
    #[serde(default = "pipeline_default_current_page")]
    current_page: usize,
    #[serde(default)]
    page_size: usize,
    #[serde(default = "pipeline_default_row_size")]
    row_size: usize,
}

thread_local! {
    static CACHED_PIPELINE_STATIC_CONTEXT: RefCell<Option<PipelineStaticContext>> = const { RefCell::new(None) };
}

fn pipeline_default_current_page() -> usize {
    1
}

fn pipeline_default_row_size() -> usize {
    44
}

fn build_pipeline_context_from_cached_static(
    dynamic: PipelineDynamicContext,
) -> Result<BuildGridPipelineContext, JsValue> {
    CACHED_PIPELINE_STATIC_CONTEXT.with(|cached| {
        let static_context = cached.borrow().clone().ok_or_else(|| {
            JsValue::from_str("cached pipeline static context has not been initialized")
        })?;

        Ok(BuildGridPipelineContext {
            options: static_context.options,
            columns: static_context.columns,
            active_filters: dynamic.active_filters,
            sort_state: dynamic.sort_state,
            group_by_columns: dynamic.group_by_columns,
            collapsed_groups: dynamic.collapsed_groups,
            hidden_row_reasons: dynamic.hidden_row_reasons,
            expanded_rows: dynamic.expanded_rows,
            expanded_tree_rows: dynamic.expanded_tree_rows,
            current_page: dynamic.current_page,
            page_size: dynamic.page_size,
            row_size: dynamic.row_size,
        })
    })
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

/// Batch input for the prepared-filter fast path. Mirrors the TS pipeline's
/// `prepare → match-per-row` shape so the wasm boundary doesn't have to
/// re-parse regexes for each row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchesGridRowsPreparedFiltersInput {
    rows: Vec<GridRow>,
    columns: Vec<GridColumnDef>,
    options: GridOptions,
    active_filters: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchesGridRowsPreparedFiltersResult {
    rows: Vec<GridRow>,
    matches: Vec<bool>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToggleGridRowSelectionInput {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
    row_id: String,
    multi_select: bool,
    no_unselect: bool,
    can_be_invisible: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShiftGridRowSelectionInput {
    state: GridSelectionState,
    visible_row_cache: Vec<GridRow>,
    row_id: String,
    multi_select: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectAllGridRowsInput {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
    multi_select: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClearAllGridSelectionInput {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FindGridRowByKeyInput {
    rows: Vec<GridRow>,
    is_in_entity: bool,
    key: String,
    comparator: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReconcileGridSelectionInput {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectionMutationResult {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
    change: ui_grid_core::selection::SelectionChange,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectionReconcileResult {
    state: GridSelectionState,
    all_rows: Vec<GridRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RowEditMutationInput {
    state: GridRowEditState,
    row: GridRow,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RowEditMutationResult {
    state: GridRowEditState,
    row: GridRow,
    changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveGridRowEditWaitIntervalInput {
    wait_interval: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CollectGridRowEntitiesInput {
    rows: Vec<GridRow>,
    ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GridI18nAddLocaleInput {
    service: GridI18nService,
    lang: String,
    labels: serde_json::Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GridI18nServiceLangInput {
    service: GridI18nService,
    lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GridI18nResolveLabelsInput {
    service: GridI18nService,
    overrides: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GridI18nServiceResult {
    service: GridI18nService,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridExporterMenuItemsInput {
    options: GridOptions,
    labels: serde_json::Map<String, Value>,
    has_selection: bool,
    include_pdf: bool,
    include_excel: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridImporterMenuItemsInput {
    options: GridOptions,
    labels: serde_json::Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridRowEditMenuItemsInput {
    options: GridOptions,
    labels: serde_json::Map<String, Value>,
    has_dirty_rows: bool,
    has_error_rows: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunColumnFilterInput {
    row: GridRecord,
    column: GridColumnDef,
    filter: ui_grid_core::models::GridFilterDescriptor,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedFilterSummary {
    term: Option<Value>,
    condition_tag: String,
    matcher_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SortValuesInput {
    column: GridColumnDef,
    rows: Vec<GridRecord>,
    #[serde(default)]
    values: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompareSortValuesInput {
    column: GridColumnDef,
    rows: Vec<GridRecord>,
    left: Value,
    right: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveGridTemplateValueInput {
    context: Value,
    expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InterpolateGridTemplateInput {
    template_markup: String,
    context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryNameArgumentInput {
    registry: GridValidatorRegistry,
    name: String,
    argument: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RowEntityColumnInput {
    row_entity: GridRecord,
    col_def: GridColumnDef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RowEntityColumnValidatorInput {
    row_entity: GridRecord,
    col_def: GridColumnDef,
    validator_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ErrorMessagesInput {
    row_entity: GridRecord,
    col_def: GridColumnDef,
    registry: GridValidatorRegistry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunGridCellValidatorsInput {
    row_entity: GridRecord,
    col_def: GridColumnDef,
    new_value: Value,
    old_value: Value,
    registry: GridValidatorRegistry,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunGridCellValidatorsResult {
    row_entity: GridRecord,
    failures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidateAllGridRowsInput {
    row_entities: Vec<GridRecord>,
    column_defs: Vec<GridColumnDef>,
    registry: GridValidatorRegistry,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidateAllGridRowsResult {
    row_entities: Vec<GridRecord>,
    invalid_rows: Vec<GridRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DefaultGridImporterProcessHeadersInput {
    column_defs: Option<Vec<GridColumnDef>>,
    header_row: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParseGridImporterJsonInput {
    source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ParseGridImporterJsonResult {
    parsed: Option<Vec<GridRecord>>,
    error_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridImporterObjectsFromCsvInput {
    import_array: Vec<Vec<String>>,
    column_defs: Option<Vec<GridColumnDef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilterExporterColumnsInput {
    columns: Vec<GridColumnDef>,
    options: ui_grid_core::export::GridExporterOptions,
    col_type: GridExporterColumnType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridCsvInput {
    columns: Vec<GridColumnDef>,
    rows: Vec<GridRow>,
    options: ui_grid_core::export::GridExporterOptions,
    col_type: GridExporterColumnType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CalculateGridPdfColumnWidthsInput {
    columns: Vec<GridColumnDef>,
    max_grid_width: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormatGridPdfFieldInput {
    value: Value,
    alignment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridPdfDocDefinitionInput {
    columns: Vec<GridColumnDef>,
    rows: Vec<GridRow>,
    pdf_options: ui_grid_core::export::GridExporterPdfOptions,
    exporter_options: ui_grid_core::export::GridExporterOptions,
    col_type: GridExporterColumnType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildGridExcelSheetDataInput {
    columns: Vec<GridColumnDef>,
    rows: Vec<GridRow>,
    exporter_options: ui_grid_core::export::GridExporterOptions,
    col_type: GridExporterColumnType,
    styles: Option<Value>,
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

fn sort_kind_tag(kind: SortKind) -> &'static str {
    match kind {
        SortKind::Basic => "basic",
        SortKind::Number => "number",
        SortKind::NumberString => "numberString",
        SortKind::Alpha => "alpha",
        SortKind::Date => "date",
        SortKind::Boolean => "boolean",
        // Bridge label so callers can identify columns whose ordering
        // must be re-sorted host-side using the original JS callback.
        SortKind::DeferToHost => "deferToHost",
    }
}

fn parsed_condition_tag(condition: &ParsedCondition) -> &'static str {
    match condition {
        ParsedCondition::Regex(_) => "regex",
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::Contains) => {
            "contains"
        }
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::StartsWith) => {
            "startsWith"
        }
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::EndsWith) => {
            "endsWith"
        }
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::Exact) => "exact",
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::NotEqual) => {
            "notEqual"
        }
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::GreaterThan) => {
            "greaterThan"
        }
        ParsedCondition::Comparator(
            ui_grid_core::constants::FilterCondition::GreaterThanOrEqual,
        ) => "greaterThanOrEqual",
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::LessThan) => {
            "lessThan"
        }
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::LessThanOrEqual) => {
            "lessThanOrEqual"
        }
    }
}

fn parsed_matcher_kind(
    descriptor: &ui_grid_core::models::GridFilterDescriptor,
    condition: &ParsedCondition,
) -> Option<String> {
    match condition {
        ParsedCondition::Regex(_) => match descriptor.condition {
            Some(ui_grid_core::constants::FilterCondition::StartsWith) => {
                Some("startsWith".to_string())
            }
            Some(ui_grid_core::constants::FilterCondition::EndsWith) => {
                Some("endsWith".to_string())
            }
            Some(ui_grid_core::constants::FilterCondition::Exact) => Some("exact".to_string()),
            Some(ui_grid_core::constants::FilterCondition::Contains) => {
                Some("contains".to_string())
            }
            None => match get_term(descriptor) {
                // A `*`-bearing term that built a successful wildcard regex
                // does not have a `containsRE` matcher in TS — reflect that
                // as `None`. Anything else (literal contains, oversized
                // wildcard fallback, etc.) maps to `containsRE`.
                Some(Value::String(value))
                    if value.contains('*') && build_wildcard_pattern(&value).is_some() =>
                {
                    None
                }
                _ => Some("contains".to_string()),
            },
            _ => None,
        },
        ParsedCondition::Comparator(ui_grid_core::constants::FilterCondition::Contains) => {
            Some("contains".to_string())
        }
        _ => None,
    }
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

/// Walk options.data (recursively for tree mode) calling the JS rowIdentity
/// callback for each record, returning a parallel index→id map. Used to
/// pre-resolve identities at the wasm boundary so the Rust core never has
/// to invoke a JS closure.
fn collect_row_identity_overrides(
    raw_options: &JsValue,
    options: &ui_grid_core::models::GridOptions,
) -> Option<std::collections::BTreeMap<usize, String>> {
    let callback = js_sys::Reflect::get(raw_options, &JsValue::from_str("rowIdentity"))
        .ok()
        .and_then(|value| {
            if value.is_function() {
                Some(js_sys::Function::from(value))
            } else {
                None
            }
        })?;

    let tree_enabled = ui_grid_core::viewmodel::is_grid_tree_enabled(options);
    let children_field = options
        .tree_children_field
        .clone()
        .unwrap_or_else(|| "children".to_string());

    let mut overrides: std::collections::BTreeMap<usize, String> =
        std::collections::BTreeMap::new();
    let mut next_index: usize = 0;

    fn visit(
        entities: &[ui_grid_core::models::GridRecord],
        tree_enabled: bool,
        children_field: &str,
        callback: &js_sys::Function,
        next_index: &mut usize,
        overrides: &mut std::collections::BTreeMap<usize, String>,
    ) {
        for entity in entities {
            let index = *next_index;
            *next_index += 1;
            // Use the json-compatible serializer so JS maps come through as
            // plain Objects (with `id`, `name`, …) rather than Map instances —
            // mirrors `to_js()` behaviour and matches what callers expect.
            let serializer = serde_wasm_bindgen::Serializer::json_compatible();
            let record_js = entity.serialize(&serializer).unwrap_or(JsValue::UNDEFINED);
            if let Ok(returned) = callback.call2(
                &JsValue::UNDEFINED,
                &record_js,
                &JsValue::from_f64(index as f64),
            ) && let Some(string_value) = returned.as_string()
            {
                overrides.insert(index, string_value);
            }

            if tree_enabled
                && let Some(serde_json::Value::Array(children)) =
                    ui_grid_core::utils::get_path_value(entity, children_field)
            {
                visit(
                    &children,
                    tree_enabled,
                    children_field,
                    callback,
                    next_index,
                    overrides,
                );
            }
        }
    }

    visit(
        &options.data,
        tree_enabled,
        &children_field,
        &callback,
        &mut next_index,
        &mut overrides,
    );

    if overrides.is_empty() {
        None
    } else {
        Some(overrides)
    }
}

/// Walk the raw JS `columns` (or `options.columnDefs`) and mark each
/// parsed column with `has_sorting_algorithm = true` when the source JS
/// column has a function-typed `sortingAlgorithm` field. The Rust sorter
/// reads this flag to emit `SortKind::DeferToHost` so the row order is
/// preserved for the bridge to re-sort host-side.
fn flag_columns_with_host_sort(raw_columns: &JsValue, parsed_columns: &mut [GridColumnDef]) {
    if !raw_columns.is_object() {
        return;
    }
    let array: js_sys::Array = match raw_columns.clone().dyn_into() {
        Ok(array) => array,
        Err(_) => return,
    };
    for (index, column) in parsed_columns.iter_mut().enumerate() {
        let raw = array.get(index as u32);
        if !raw.is_object() {
            continue;
        }
        let sorter = js_sys::Reflect::get(&raw, &JsValue::from_str("sortingAlgorithm"))
            .unwrap_or(JsValue::UNDEFINED);
        if sorter.is_function() {
            column.has_sorting_algorithm = true;
        }
    }
}

#[wasm_bindgen]
pub fn build_pipeline_js(context: JsValue) -> Result<JsValue, JsValue> {
    // Forward `options.rowIdentity` callback through to the Rust core via
    // the row_identity_overrides hidden field. See build_grid_rows_js for
    // the contract.
    let raw_options =
        js_sys::Reflect::get(&context, &JsValue::from_str("options")).unwrap_or(JsValue::UNDEFINED);
    let raw_columns =
        js_sys::Reflect::get(&context, &JsValue::from_str("columns")).unwrap_or(JsValue::UNDEFINED);
    let mut parsed: BuildGridPipelineContext = from_js(context)?;
    if let Some(overrides) = collect_row_identity_overrides(&raw_options, &parsed.options) {
        parsed.options.row_identity_overrides = Some(overrides);
    }
    flag_columns_with_host_sort(&raw_columns, &mut parsed.columns);
    let result = build_grid_pipeline(&parsed);
    to_js(&result)
}

#[wasm_bindgen]
pub fn set_cached_pipeline_static_context_js(context: JsValue) -> Result<(), JsValue> {
    let context: PipelineStaticContext = from_js(context)?;
    CACHED_PIPELINE_STATIC_CONTEXT.with(|cached| {
        *cached.borrow_mut() = Some(context);
    });
    Ok(())
}

#[wasm_bindgen]
pub fn clear_cached_pipeline_static_context_js() {
    CACHED_PIPELINE_STATIC_CONTEXT.with(|cached| {
        *cached.borrow_mut() = None;
    });
}

#[wasm_bindgen]
pub fn build_pipeline_from_cached_static_context_js(context: JsValue) -> Result<JsValue, JsValue> {
    let dynamic: PipelineDynamicContext = from_js(context)?;
    let context = build_pipeline_context_from_cached_static(dynamic)?;
    let result = build_grid_pipeline(&context);
    to_js(&result)
}

#[wasm_bindgen]
pub fn build_grid_pipeline_js(context: JsValue) -> Result<JsValue, JsValue> {
    build_pipeline_js(context)
}

/// Cache lookup variant of `build_grid_rows`. Returns the cached
/// `Vec<GridRow>` when the input identity matches the previous call;
/// otherwise rebuilds. Mirrors TS `getCachedGridPipelineRows`.
///
/// Note: across the wasm boundary every call deserializes a fresh context,
/// so the raw-pointer identity comparison the underlying cache uses will
/// almost always miss — the cache only delivers value when callers from
/// inside Rust (e.g. the egui adapter) reuse a stable context across
/// pipeline passes. The shim is exposed for symmetry with the TS API.
#[wasm_bindgen]
pub fn get_cached_grid_pipeline_rows_js(context: JsValue) -> Result<JsValue, JsValue> {
    let raw_options =
        js_sys::Reflect::get(&context, &JsValue::from_str("options")).unwrap_or(JsValue::UNDEFINED);
    let mut parsed: BuildGridPipelineContext = from_js(context)?;
    if let Some(overrides) = collect_row_identity_overrides(&raw_options, &parsed.options) {
        parsed.options.row_identity_overrides = Some(overrides);
    }
    let rows = get_cached_grid_pipeline_rows(&parsed);
    to_js(&rows)
}

/// Drop the rows cache. Mirrors TS `clearGridPipelineRowsCache`.
#[wasm_bindgen]
pub fn clear_grid_pipeline_rows_cache_js() {
    clear_grid_pipeline_rows_cache();
}

// Row searcher

#[wasm_bindgen]
pub fn get_grid_filter_term_js(filter: JsValue) -> Result<JsValue, JsValue> {
    let filter: ui_grid_core::models::GridFilterDescriptor = from_js(filter)?;
    to_js(&get_term(&filter))
}

#[wasm_bindgen]
pub fn setup_grid_filters_js(filters: JsValue) -> Result<JsValue, JsValue> {
    let filters: Vec<ui_grid_core::models::GridFilterDescriptor> = from_js(filters)?;
    let parsed = setup_filters(&filters);
    let summaries = filters
        .iter()
        .zip(parsed.iter())
        .map(|(descriptor, parsed)| ParsedFilterSummary {
            term: parsed.term.clone(),
            condition_tag: parsed_condition_tag(&parsed.condition).to_string(),
            matcher_kind: parsed_matcher_kind(descriptor, &parsed.condition),
        })
        .collect::<Vec<_>>();
    to_js(&summaries)
}

#[wasm_bindgen]
pub fn run_grid_column_filter_js(input: JsValue) -> Result<bool, JsValue> {
    let input: RunColumnFilterInput = from_js(input)?;
    let parsed = setup_filters(&[input.filter]);
    let Some(filter) = parsed.first() else {
        return Ok(false);
    };
    Ok(run_column_filter(&input.row, &input.column, filter))
}

// Row sorter

#[wasm_bindgen]
pub fn guess_grid_sort_kind_js(input: JsValue) -> Result<String, JsValue> {
    let input: SortValuesInput = from_js(input)?;
    Ok(sort_kind_tag(guess_sort_kind(&input.column, &input.rows)).to_string())
}

#[wasm_bindgen]
pub fn compare_grid_sort_values_js(input: JsValue) -> Result<i32, JsValue> {
    let input: CompareSortValuesInput = from_js(input)?;
    let kind = guess_sort_kind(&input.column, &input.rows);
    let ordering = compare_values(kind, &input.left, &input.right);
    Ok(match ordering {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    })
}

#[wasm_bindgen]
pub fn sort_grid_scalar_values_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: SortValuesInput = from_js(input)?;
    let kind = guess_sort_kind(&input.column, &input.rows);
    let mut values = input.values;
    values.sort_by(|left, right| compare_values(kind, left, right));
    to_js(&values)
}

// Template

#[wasm_bindgen]
pub fn resolve_grid_template_value_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ResolveGridTemplateValueInput = from_js(input)?;
    to_js(&resolve_grid_template_value(
        &input.context,
        &input.expression,
    ))
}

#[wasm_bindgen]
pub fn interpolate_grid_template_js(input: JsValue) -> Result<String, JsValue> {
    let input: InterpolateGridTemplateInput = from_js(input)?;
    Ok(interpolate_grid_template(
        &input.template_markup,
        &input.context,
    ))
}

// Validate

#[wasm_bindgen]
pub fn create_grid_validator_registry_js(labels: JsValue) -> Result<JsValue, JsValue> {
    let labels: GridLabels = from_js(labels)?;
    to_js(&create_grid_validator_registry(&labels))
}

#[wasm_bindgen]
pub fn grid_validator_has_js(input: JsValue) -> Result<bool, JsValue> {
    let input: RegistryNameArgumentInput = from_js(input)?;
    Ok(input.registry.has(&input.name))
}

#[wasm_bindgen]
pub fn grid_validator_message_js(input: JsValue) -> Result<String, JsValue> {
    let input: RegistryNameArgumentInput = from_js(input)?;
    Ok(input.registry.get_message(&input.name, &input.argument))
}

#[wasm_bindgen]
pub fn invalid_field_for_js(col_def: JsValue) -> Result<String, JsValue> {
    let col_def: GridColumnDef = from_js(col_def)?;
    Ok(invalid_field_for(&col_def))
}

#[wasm_bindgen]
pub fn errors_field_for_js(col_def: JsValue) -> Result<String, JsValue> {
    let col_def: GridColumnDef = from_js(col_def)?;
    Ok(errors_field_for(&col_def))
}

#[wasm_bindgen]
pub fn is_grid_cell_invalid_js(input: JsValue) -> Result<bool, JsValue> {
    let input: RowEntityColumnInput = from_js(input)?;
    Ok(is_grid_cell_invalid(&input.row_entity, &input.col_def))
}

#[wasm_bindgen]
pub fn set_grid_cell_invalid_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEntityColumnInput = from_js(input)?;
    set_grid_cell_invalid(&mut input.row_entity, &input.col_def);
    to_js(&input.row_entity)
}

#[wasm_bindgen]
pub fn set_grid_cell_valid_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEntityColumnInput = from_js(input)?;
    set_grid_cell_valid(&mut input.row_entity, &input.col_def);
    to_js(&input.row_entity)
}

#[wasm_bindgen]
pub fn set_grid_cell_error_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEntityColumnValidatorInput = from_js(input)?;
    set_grid_cell_error(&mut input.row_entity, &input.col_def, &input.validator_name);
    to_js(&input.row_entity)
}

#[wasm_bindgen]
pub fn clear_grid_cell_error_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEntityColumnValidatorInput = from_js(input)?;
    clear_grid_cell_error(&mut input.row_entity, &input.col_def, &input.validator_name);
    to_js(&input.row_entity)
}

#[wasm_bindgen]
pub fn get_grid_cell_error_names_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: RowEntityColumnInput = from_js(input)?;
    to_js(&get_grid_cell_error_names(
        &input.row_entity,
        &input.col_def,
    ))
}

#[wasm_bindgen]
pub fn get_grid_cell_error_messages_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ErrorMessagesInput = from_js(input)?;
    to_js(&get_grid_cell_error_messages(
        &input.row_entity,
        &input.col_def,
        &input.registry,
    ))
}

#[wasm_bindgen]
pub fn run_grid_cell_validators_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RunGridCellValidatorsInput = from_js(input)?;
    let failures = run_grid_cell_validators(
        &mut input.row_entity,
        &input.col_def,
        &input.new_value,
        &input.old_value,
        &input.registry,
    )
    .map_err(|error| JsValue::from_str(&error))?;
    to_js(&RunGridCellValidatorsResult {
        row_entity: input.row_entity,
        failures,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetGridValidatorInput {
    registry: GridValidatorRegistry,
    name: String,
    message_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetGridValidatorInput {
    registry: GridValidatorRegistry,
    name: String,
}

/// Register a consumer validator's message template on the Rust side
/// of the registry. Mirrors TS `GridValidatorRegistry.setValidator` for
/// the parts that survive the wasm boundary — the validator function
/// itself stays JS-side and is invoked through the host bridge. Returns
/// the mutated registry.
#[wasm_bindgen]
pub fn set_grid_validator_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: SetGridValidatorInput = from_js(input)?;
    input
        .registry
        .set_validator(input.name, input.message_template);
    to_js(&input.registry)
}

/// Look up a validator by name. Returns a [`HostValidatorMarker`] when
/// the name is known (built-in or consumer-registered), or an error
/// matching TS `Invalid validator name: <name>` for unknowns. The
/// marker tells the bridge whether Rust can run the check (`built_in:
/// true`) or the host must invoke its registered callback.
#[wasm_bindgen]
pub fn get_grid_validator_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: GetGridValidatorInput = from_js(input)?;
    let marker: HostValidatorMarker = input
        .registry
        .get_validator(&input.name)
        .map_err(|error| JsValue::from_str(&error))?;
    to_js(&marker)
}

#[wasm_bindgen]
pub fn validate_all_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: ValidateAllGridRowsInput = from_js(input)?;
    let invalid_rows =
        validate_all_grid_rows(&mut input.row_entities, &input.column_defs, &input.registry)
            .map_err(|error| JsValue::from_str(&error))?;
    to_js(&ValidateAllGridRowsResult {
        row_entities: input.row_entities,
        invalid_rows,
    })
}

// Importer

#[wasm_bindgen]
pub fn resolve_grid_importer_options_js(options: JsValue) -> Result<JsValue, JsValue> {
    let options: GridOptions = from_js(options)?;
    to_js(&resolve_grid_importer_options(&options))
}

#[wasm_bindgen]
pub fn flatten_grid_column_defs_for_import_js(column_defs: JsValue) -> Result<JsValue, JsValue> {
    let column_defs: Vec<GridColumnDef> = from_js(column_defs)?;
    to_js(&flatten_grid_column_defs_for_import(&column_defs, None))
}

#[wasm_bindgen]
pub fn default_grid_importer_process_headers_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: DefaultGridImporterProcessHeadersInput = from_js(input)?;
    to_js(&default_grid_importer_process_headers(
        input.column_defs.as_deref(),
        &input.header_row,
        None,
    ))
}

#[wasm_bindgen]
pub fn parse_grid_importer_json_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ParseGridImporterJsonInput = from_js(input)?;
    let result = match parse_grid_importer_json(&input.source) {
        Ok(parsed) => ParseGridImporterJsonResult {
            parsed: Some(parsed),
            error_key: None,
        },
        Err(ui_grid_core::importer::GridImporterJsonError::InvalidJson) => {
            ParseGridImporterJsonResult {
                parsed: None,
                error_key: Some("importer.invalidJson".to_string()),
            }
        }
        Err(ui_grid_core::importer::GridImporterJsonError::JsonNotArray) => {
            ParseGridImporterJsonResult {
                parsed: Some(Vec::new()),
                error_key: Some("importer.jsonNotarray".to_string()),
            }
        }
    };
    to_js(&result)
}

#[wasm_bindgen]
pub fn parse_grid_importer_csv_js(source: JsValue) -> Result<JsValue, JsValue> {
    let source: String = from_js(source)?;
    to_js(&parse_grid_importer_csv(&source))
}

#[wasm_bindgen]
pub fn build_grid_importer_objects_from_csv_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridImporterObjectsFromCsvInput = from_js(input)?;
    to_js(&build_grid_importer_objects_from_csv(
        &input.import_array,
        input.column_defs.as_deref(),
    ))
}

#[wasm_bindgen]
pub fn build_grid_importer_objects_from_json_js(parsed: JsValue) -> Result<JsValue, JsValue> {
    let parsed: Vec<GridRecord> = from_js(parsed)?;
    to_js(&build_grid_importer_objects_from_json(&parsed))
}

// Exporter

#[wasm_bindgen]
pub fn filter_exporter_columns_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FilterExporterColumnsInput = from_js(input)?;
    to_js(&filter_exporter_columns(
        &input.columns,
        &input.options,
        input.col_type,
    ))
}

#[wasm_bindgen]
pub fn build_grid_csv_js(input: JsValue) -> Result<String, JsValue> {
    let input: BuildGridCsvInput = from_js(input)?;
    Ok(build_grid_csv(
        &input.columns,
        &input.rows,
        &input.options,
        input.col_type,
    ))
}

#[wasm_bindgen]
pub fn resolve_grid_exporter_options_js(options: JsValue) -> Result<JsValue, JsValue> {
    let options: GridOptions = from_js(options)?;
    to_js(&resolve_grid_exporter_options(&options))
}

#[wasm_bindgen]
pub fn resolve_grid_exporter_pdf_options_js(options: JsValue) -> Result<JsValue, JsValue> {
    let options: GridOptions = from_js(options)?;
    to_js(&resolve_grid_exporter_pdf_options(&options))
}

#[wasm_bindgen]
pub fn resolve_grid_exporter_excel_options_js(options: JsValue) -> Result<JsValue, JsValue> {
    let options: GridOptions = from_js(options)?;
    to_js(&resolve_grid_exporter_excel_options(&options))
}

#[wasm_bindgen]
pub fn calculate_grid_pdf_column_widths_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: CalculateGridPdfColumnWidthsInput = from_js(input)?;
    to_js(&calculate_grid_pdf_column_widths(
        &input.columns,
        input.max_grid_width,
    ))
}

#[wasm_bindgen]
pub fn format_grid_pdf_field_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FormatGridPdfFieldInput = from_js(input)?;
    to_js(&format_grid_pdf_field(
        &input.value,
        input.alignment.as_deref(),
    ))
}

#[wasm_bindgen]
pub fn build_grid_pdf_doc_definition_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridPdfDocDefinitionInput = from_js(input)?;
    to_js(&build_grid_pdf_doc_definition(
        &input.columns,
        &input.rows,
        &input.pdf_options,
        &input.exporter_options,
        input.col_type,
    ))
}

#[wasm_bindgen]
pub fn format_grid_excel_field_js(value: JsValue) -> Result<JsValue, JsValue> {
    let value: Value = from_js(value)?;
    to_js(&format_grid_excel_field(&value))
}

#[wasm_bindgen]
pub fn build_grid_excel_sheet_data_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridExcelSheetDataInput = from_js(input)?;
    to_js(&build_grid_excel_sheet_data(
        &input.columns,
        &input.rows,
        &input.exporter_options,
        input.col_type,
        input.styles.as_ref(),
    ))
}

// Selection

#[wasm_bindgen]
pub fn create_grid_selection_state_js() -> Result<JsValue, JsValue> {
    to_js(&create_grid_selection_state())
}

#[wasm_bindgen]
pub fn resolve_grid_selection_options_js(options: JsValue) -> Result<JsValue, JsValue> {
    let callback_value = js_sys::Reflect::get(&options, &JsValue::from_str("isRowSelectable"))
        .unwrap_or(JsValue::UNDEFINED);
    let options: GridOptions = from_js(options)?;
    let output = to_js(&resolve_grid_selection_options(&options))?;
    let callback_value = if callback_value.is_undefined() {
        JsValue::NULL
    } else {
        callback_value
    };
    js_sys::Reflect::set(
        &output,
        &JsValue::from_str("isRowSelectable"),
        &callback_value,
    )?;
    Ok(output)
}

#[wasm_bindgen]
pub fn toggle_grid_row_selection_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: ToggleGridRowSelectionInput = from_js(input)?;
    let change = toggle_grid_row_selection(
        &mut input.state,
        &mut input.all_rows,
        &input.row_id,
        &ToggleGridRowSelectionOptions {
            multi_select: input.multi_select,
            no_unselect: input.no_unselect,
            can_be_invisible: input.can_be_invisible.unwrap_or(true),
        },
    );
    to_js(&SelectionMutationResult {
        state: input.state,
        all_rows: input.all_rows,
        change,
    })
}

#[wasm_bindgen]
pub fn shift_grid_row_selection_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: ShiftGridRowSelectionInput = from_js(input)?;
    let change = shift_grid_row_selection(
        &mut input.state,
        &mut input.visible_row_cache,
        &input.row_id,
        &ShiftGridRowSelectionOptions {
            multi_select: input.multi_select,
        },
    );
    to_js(&SelectionMutationResult {
        state: input.state,
        all_rows: input.visible_row_cache,
        change,
    })
}

#[wasm_bindgen]
pub fn select_all_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: SelectAllGridRowsInput = from_js(input)?;
    let change = select_all_grid_rows(
        &mut input.state,
        &mut input.all_rows,
        &SelectAllGridRowsOptions {
            multi_select: input.multi_select,
        },
    );
    to_js(&SelectionMutationResult {
        state: input.state,
        all_rows: input.all_rows,
        change,
    })
}

#[wasm_bindgen]
pub fn select_all_visible_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: SelectAllGridRowsInput = from_js(input)?;
    let change = select_all_visible_grid_rows(
        &mut input.state,
        &mut input.all_rows,
        &SelectAllGridRowsOptions {
            multi_select: input.multi_select,
        },
    );
    to_js(&SelectionMutationResult {
        state: input.state,
        all_rows: input.all_rows,
        change,
    })
}

#[wasm_bindgen]
pub fn clear_all_grid_selection_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: ClearAllGridSelectionInput = from_js(input)?;
    let change = clear_all_grid_selection(&mut input.state, &mut input.all_rows);
    to_js(&SelectionMutationResult {
        state: input.state,
        all_rows: input.all_rows,
        change,
    })
}

#[wasm_bindgen]
pub fn find_grid_row_by_key_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: FindGridRowByKeyInput = from_js(input)?;
    to_js(&find_grid_row_by_key(
        &input.rows,
        input.is_in_entity,
        &input.key,
        &input.comparator,
    ))
}

#[wasm_bindgen]
pub fn reconcile_grid_selection_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: ReconcileGridSelectionInput = from_js(input)?;
    reconcile_grid_selection(&mut input.state, &mut input.all_rows);
    to_js(&SelectionReconcileResult {
        state: input.state,
        all_rows: input.all_rows,
    })
}

#[wasm_bindgen]
pub fn map_selected_rows_to_entities_js(rows: JsValue) -> Result<JsValue, JsValue> {
    let rows: Vec<GridRow> = from_js(rows)?;
    to_js(&map_selected_rows_to_entities(&rows))
}

// Row edit

#[wasm_bindgen]
pub fn create_grid_row_edit_state_js() -> Result<JsValue, JsValue> {
    to_js(&create_grid_row_edit_state())
}

#[wasm_bindgen]
pub fn mark_grid_row_dirty_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEditMutationInput = from_js(input)?;
    let changed = mark_grid_row_dirty(&mut input.state, &mut input.row);
    to_js(&RowEditMutationResult {
        state: input.state,
        row: input.row,
        changed,
    })
}

#[wasm_bindgen]
pub fn mark_grid_row_clean_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEditMutationInput = from_js(input)?;
    mark_grid_row_clean(&mut input.state, &mut input.row);
    to_js(&RowEditMutationResult {
        state: input.state,
        row: input.row,
        changed: true,
    })
}

#[wasm_bindgen]
pub fn mark_grid_row_saving_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEditMutationInput = from_js(input)?;
    mark_grid_row_saving(&mut input.state, &mut input.row);
    to_js(&RowEditMutationResult {
        state: input.state,
        row: input.row,
        changed: true,
    })
}

#[wasm_bindgen]
pub fn mark_grid_row_error_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: RowEditMutationInput = from_js(input)?;
    mark_grid_row_error(&mut input.state, &mut input.row);
    to_js(&RowEditMutationResult {
        state: input.state,
        row: input.row,
        changed: true,
    })
}

#[wasm_bindgen]
pub fn is_grid_row_edit_timer_enabled_js(wait_interval: JsValue) -> Result<bool, JsValue> {
    let wait_interval: Option<i32> = from_js(wait_interval)?;
    Ok(is_grid_row_edit_timer_enabled(wait_interval))
}

#[wasm_bindgen]
pub fn resolve_grid_row_edit_wait_interval_js(input: JsValue) -> Result<i32, JsValue> {
    let input: ResolveGridRowEditWaitIntervalInput = from_js(input)?;
    Ok(resolve_grid_row_edit_wait_interval(input.wait_interval))
}

#[wasm_bindgen]
pub fn collect_grid_row_entities_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: CollectGridRowEntitiesInput = from_js(input)?;
    let ids = input.ids.into_iter().collect();
    to_js(&collect_grid_row_entities(&input.rows, &ids))
}

// i18n

#[wasm_bindgen]
pub fn create_grid_i18n_service_js() -> Result<JsValue, JsValue> {
    to_js(&create_grid_i18n_service())
}

#[wasm_bindgen]
pub fn add_grid_i18n_locale_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: GridI18nAddLocaleInput = from_js(input)?;
    add_grid_i18n_locale(&mut input.service, &input.lang, input.labels);
    to_js(&GridI18nServiceResult {
        service: input.service,
    })
}

#[wasm_bindgen]
pub fn get_grid_i18n_labels_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: GridI18nServiceLangInput = from_js(input)?;
    to_js(&get_grid_i18n_labels(&input.service, &input.lang))
}

#[wasm_bindgen]
pub fn set_grid_i18n_current_lang_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: GridI18nServiceLangInput = from_js(input)?;
    set_grid_i18n_current_lang(&mut input.service, &input.lang);
    to_js(&GridI18nServiceResult {
        service: input.service,
    })
}

#[wasm_bindgen]
pub fn get_grid_i18n_current_lang_js(service: JsValue) -> Result<String, JsValue> {
    let service: GridI18nService = from_js(service)?;
    Ok(get_grid_i18n_current_lang(&service))
}

#[wasm_bindgen]
pub fn get_grid_i18n_supported_languages_js(service: JsValue) -> Result<JsValue, JsValue> {
    let service: GridI18nService = from_js(service)?;
    to_js(&get_grid_i18n_supported_languages(&service))
}

#[wasm_bindgen]
pub fn get_grid_i18n_current_labels_js(service: JsValue) -> Result<JsValue, JsValue> {
    let service: GridI18nService = from_js(service)?;
    to_js(&get_grid_i18n_current_labels(&service))
}

#[wasm_bindgen]
pub fn resolve_labels_from_i18n_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: GridI18nResolveLabelsInput = from_js(input)?;
    to_js(&resolve_labels_from_i18n(&input.service, input.overrides))
}

// Menus

#[wasm_bindgen]
pub fn build_grid_exporter_menu_items_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridExporterMenuItemsInput = from_js(input)?;
    to_js(&build_grid_exporter_menu_items(
        &input.options,
        &input.labels,
        &GridExporterMenuContext {
            has_selection: input.has_selection,
            include_pdf: input.include_pdf,
            include_excel: input.include_excel,
        },
    ))
}

#[wasm_bindgen]
pub fn build_grid_importer_menu_items_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridImporterMenuItemsInput = from_js(input)?;
    to_js(&build_grid_importer_menu_items(
        &input.options,
        &input.labels,
    ))
}

#[wasm_bindgen]
pub fn build_grid_row_edit_menu_items_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: BuildGridRowEditMenuItemsInput = from_js(input)?;
    to_js(&build_grid_row_edit_menu_items(
        &input.options,
        &input.labels,
        &GridRowEditMenuPredicates {
            has_dirty_rows: input.has_dirty_rows,
            has_error_rows: input.has_error_rows,
        },
    ))
}

// Viewmodel

#[wasm_bindgen]
pub fn resolve_grid_labels_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ResolveGridLabelsInput = from_js(input)?;
    to_js(&resolve_grid_labels(
        &input.current_labels,
        input.overrides.as_ref(),
    ))
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
    // The TS canonical resolves `options.rowIdentity?.(record, rowIndex)`
    // when the row passed in is a bare GridRecord (not a string and not a
    // GridRow with `id` + `entity` fields). The callback can't survive serde
    // serialization, so pluck it off the original JsValue before deserializing.
    let raw_options =
        js_sys::Reflect::get(&input, &JsValue::from_str("options")).unwrap_or(JsValue::UNDEFINED);
    let row_identity_callback =
        js_sys::Reflect::get(&raw_options, &JsValue::from_str("rowIdentity"))
            .ok()
            .and_then(|value| {
                if value.is_function() {
                    Some(js_sys::Function::from(value))
                } else {
                    None
                }
            });

    let parsed: ResolveGridRowIdInput = from_js(input)?;

    // Mirror TS branches: bare-string → return as-is.
    if let Some(string_value) = parsed.row.as_str() {
        return Ok(string_value.to_string());
    }

    // GridRow shape — has both `id` and `entity` fields → return `id` directly.
    if let Some(object) = parsed.row.as_object()
        && object.contains_key("id")
        && object.contains_key("entity")
        && let Some(serde_json::Value::String(id)) = object.get("id")
    {
        return Ok(id.clone());
    }

    // Otherwise we have a GridRecord. If a JS rowIdentity callback was
    // provided, invoke it with (record, rowIndex). Else fall through to the
    // Rust core's row_id_field heuristic.
    if let Some(callback) = row_identity_callback {
        // Locate row index in options.data by JSON-equality.
        let row_index = parsed
            .options
            .data
            .iter()
            .position(|candidate| candidate == &parsed.row)
            .map(|index| index as i32)
            .unwrap_or(-1);
        // Use the json-compatible serializer so the JS callback sees a plain
        // object (`{id, name}`) instead of a `Map` instance — matches the
        // behaviour of `to_js()` for outputs.
        let serializer = serde_wasm_bindgen::Serializer::json_compatible();
        let record_js = parsed
            .row
            .serialize(&serializer)
            .map_err(|error| JsValue::from_str(&format!("failed to encode row: {error}")))?;
        let returned = callback
            .call2(
                &JsValue::UNDEFINED,
                &record_js,
                &JsValue::from_f64(row_index as f64),
            )
            .ok();
        if let Some(value) = returned
            && let Some(string_value) = value.as_string()
        {
            return Ok(string_value);
        }
        // Fallback when callback returned non-string or threw — match TS
        // `${options.id}-${rowIndex}` shape.
        return Ok(format!("{}-{}", parsed.options.id, row_index.max(0)));
    }

    Ok(resolve_grid_row_id(&parsed.options, &parsed.row))
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

/// Build a header-template context for the given column. The serialized
/// shape mirrors TS `GridHeaderTemplateContext`: `{ $implicit, value,
/// column }`. JS callers with a `headerRenderer` evaluate it host-side
/// against this context after deserialization.
#[wasm_bindgen]
pub fn build_grid_header_context_js(input: JsValue) -> Result<JsValue, JsValue> {
    let input: HeaderLabelInput = from_js(input)?;
    let ctx = build_grid_header_context(&input.column);
    to_js(&ctx)
}

/// Resolve the header display string. Closures can't cross the wasm
/// boundary, so this returns the resolved `value`; the bridge wrapper
/// runs `column.headerRenderer` host-side when present.
#[wasm_bindgen]
pub fn format_grid_header_display_value_js(input: JsValue) -> Result<String, JsValue> {
    let ctx: GridHeaderTemplateContext = from_js(input)?;
    Ok(format_grid_header_display_value(&ctx))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveExporterFilenameInput {
    #[serde(default)]
    filename: Option<String>,
    fallback: String,
    row_type: GridExporterRowType,
    col_type: GridExporterColumnType,
}

/// Resolve the output filename. JS callers with a function-typed
/// `filename` resolve it host-side and pass the resulting string here;
/// callers with a static string get it through; callers with nothing
/// get the supplied fallback. Mirrors TS `resolveExporterFilename`.
#[wasm_bindgen]
pub fn resolve_exporter_filename_js(input: JsValue) -> Result<String, JsValue> {
    let input: ResolveExporterFilenameInput = from_js(input)?;
    Ok(resolve_exporter_filename(
        input.filename.as_deref(),
        &input.fallback,
        input.row_type,
        input.col_type,
    ))
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

/// Prepared-filter fast path: parse column filter specs once, then evaluate
/// every row against the prepared specs. Returns parallel `rows` (mutated
/// invisibility reasons) and `matches` arrays. Callers with no active
/// filters should bypass this entirely. Mirrors the TS
/// `prepareGridColumnFilters` + `matchesGridRowPreparedFilters` pair.
#[wasm_bindgen]
pub fn matches_grid_rows_prepared_filters_js(input: JsValue) -> Result<JsValue, JsValue> {
    let mut input: MatchesGridRowsPreparedFiltersInput = from_js(input)?;
    if !input.options.enable_filtering {
        let matches: Vec<bool> = input.rows.iter().map(|row| row.visible).collect();
        return to_js(&MatchesGridRowsPreparedFiltersResult {
            rows: input.rows,
            matches,
        });
    }

    let prepared = prepare_grid_column_filters(&input.columns, &input.active_filters);
    let mut matches = Vec::with_capacity(input.rows.len());
    for row in input.rows.iter_mut() {
        // Clear stale reasons for columns whose filter is no longer active.
        if !row.invisible_reasons.is_empty() {
            for column in &input.columns {
                let key = format!("filter:{}", column.name);
                let active = input
                    .active_filters
                    .get(&column.name)
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                    .is_some();
                if !active && row.invisible_reasons.contains(&key) {
                    row.clear_this_row_invisible(&key);
                }
            }
        }
        matches.push(matches_grid_row_prepared_filters(row, &prepared));
    }
    to_js(&MatchesGridRowsPreparedFiltersResult {
        rows: input.rows,
        matches,
    })
}

#[wasm_bindgen]
pub fn sort_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    let raw_columns =
        js_sys::Reflect::get(&input, &JsValue::from_str("columns")).unwrap_or(JsValue::UNDEFINED);
    let mut input: SortRowsInput = from_js(input)?;
    flag_columns_with_host_sort(&raw_columns, &mut input.columns);
    to_js(&sort_grid_rows(
        &input.rows,
        &input.columns,
        &input.options,
        &input.sort_state,
    ))
}

#[wasm_bindgen]
pub fn build_grid_rows_js(input: JsValue) -> Result<JsValue, JsValue> {
    // Forward `options.rowIdentity` callback to Rust through the
    // row_identity_overrides hidden field — see build_pipeline_js.
    let raw_options =
        js_sys::Reflect::get(&input, &JsValue::from_str("options")).unwrap_or(JsValue::UNDEFINED);
    let mut input: BuildGridRowsInput = from_js(input)?;
    if let Some(overrides) = collect_row_identity_overrides(&raw_options, &input.options) {
        input.options.row_identity_overrides = Some(overrides);
    }
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
