use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::constants::{FilterCondition, SortDirection};

pub type GridRecord = Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum GridColumnType {
    #[default]
    String,
    Number,
    Boolean,
    Date,
    Object,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridFilterFlags {
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub date: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridFilterDescriptor {
    #[serde(default)]
    pub term: Option<Value>,
    #[serde(default)]
    pub condition: Option<FilterCondition>,
    #[serde(default)]
    pub flags: GridFilterFlags,
    #[serde(default)]
    pub raw_term: bool,
    #[serde(default)]
    pub no_term: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridSortDescriptor {
    #[serde(default)]
    pub direction: Option<SortDirection>,
    #[serde(default)]
    pub priority: Option<u32>,
    #[serde(default)]
    pub ignore_sort: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridColumnDef {
    pub name: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub field: Option<String>,
    #[serde(default)]
    pub r#type: GridColumnType,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default = "default_true")]
    pub sortable: bool,
    #[serde(default = "default_true")]
    pub filterable: bool,
    #[serde(default = "default_true")]
    pub enable_sorting: bool,
    #[serde(default = "default_true")]
    pub enable_filtering: bool,
    #[serde(default = "default_true")]
    pub enable_grouping: bool,
    #[serde(default)]
    pub enable_cell_edit: bool,
    #[serde(default)]
    pub enable_cell_edit_on_focus: bool,
    #[serde(default)]
    pub pinned_left: bool,
    #[serde(default)]
    pub pinned_right: bool,
    #[serde(default = "default_true")]
    pub enable_pinning: bool,
    #[serde(default)]
    pub validators: Option<serde_json::Map<String, Value>>,
    #[serde(default)]
    pub exporter_suppress_export: bool,
    #[serde(default)]
    pub exporter_pdf_align: Option<String>,
    #[serde(default)]
    pub width: Option<String>,
    #[serde(default)]
    pub align: Option<String>,
    #[serde(default)]
    pub sort: Option<GridSortDescriptor>,
    #[serde(default)]
    pub filter: Option<GridFilterDescriptor>,
}

impl Default for GridColumnDef {
    fn default() -> Self {
        Self {
            name: String::new(),
            display_name: None,
            field: None,
            r#type: GridColumnType::default(),
            visible: true,
            sortable: true,
            filterable: true,
            enable_sorting: true,
            enable_filtering: true,
            enable_grouping: true,
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            pinned_left: false,
            pinned_right: false,
            enable_pinning: true,
            validators: None,
            exporter_suppress_export: false,
            exporter_pdf_align: None,
            width: None,
            align: None,
            sort: None,
            filter: None,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridGroupingOptions {
    #[serde(default)]
    pub group_by: Vec<String>,
    #[serde(default)]
    pub start_collapsed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GridIcon {
    Grip,
    Sort,
    SortAsc,
    SortDesc,
    Group,
    Ungroup,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    PinLeft,
    PinRight,
    Unpin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridIcons {
    pub sort_default: GridIcon,
    pub sort_asc: GridIcon,
    pub sort_desc: GridIcon,
    pub group_column: GridIcon,
    pub ungroup_column: GridIcon,
    pub group_collapse: GridIcon,
    pub group_expand: GridIcon,
    pub tree_collapse: GridIcon,
    pub tree_expand: GridIcon,
    pub expand_detail: GridIcon,
    pub collapse_detail: GridIcon,
    pub drag_handle: GridIcon,
    pub move_left: GridIcon,
    pub move_right: GridIcon,
    pub pin_left: GridIcon,
    pub pin_right: GridIcon,
    pub unpin: GridIcon,
}

impl Default for GridIcons {
    fn default() -> Self {
        Self {
            sort_default: GridIcon::Sort,
            sort_asc: GridIcon::SortAsc,
            sort_desc: GridIcon::SortDesc,
            group_column: GridIcon::Group,
            ungroup_column: GridIcon::Ungroup,
            group_collapse: GridIcon::ChevronDown,
            group_expand: GridIcon::ChevronRight,
            tree_collapse: GridIcon::ChevronDown,
            tree_expand: GridIcon::ChevronRight,
            expand_detail: GridIcon::ChevronDown,
            collapse_detail: GridIcon::ChevronDown,
            drag_handle: GridIcon::Grip,
            move_left: GridIcon::ChevronLeft,
            move_right: GridIcon::ChevronRight,
            pin_left: GridIcon::PinLeft,
            pin_right: GridIcon::PinRight,
            unpin: GridIcon::Unpin,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridLabels {
    pub sort_default: String,
    pub sort_asc: String,
    pub sort_desc: String,
    pub group_column: String,
    pub ungroup_column: String,
    pub group_collapse: String,
    pub group_expand: String,
    pub tree_collapse: String,
    pub tree_expand: String,
    pub expand_detail: String,
    pub collapse_detail: String,
    pub filter_placeholder: String,
    pub filter_disabled: String,
    pub filter_column: String,
    pub pagination_previous: String,
    pub pagination_next: String,
    pub pagination_page: String,
    pub pagination_of: String,
    pub pagination_rows: String,
    pub empty_heading: String,
    pub empty_description: String,
    pub toolbar_of: String,
    pub toolbar_rows: String,
    pub stats_visible_rows: String,
    pub group_rows_suffix: String,
    pub pin_column: String,
    pub pin_left: String,
    pub pin_right: String,
    pub unpin: String,
    pub exporter_all_as_csv: String,
    pub exporter_visible_as_csv: String,
    pub exporter_selected_as_csv: String,
    pub exporter_all_as_pdf: String,
    pub exporter_visible_as_pdf: String,
    pub exporter_selected_as_pdf: String,
    pub exporter_all_as_excel: String,
    pub exporter_visible_as_excel: String,
    pub exporter_selected_as_excel: String,
    pub importer_title: String,
    pub importer_file_label: String,
    pub importer_invalid_json: String,
    pub importer_json_not_array: String,
    pub importer_invalid_csv: String,
    pub importer_no_objects: String,
    pub importer_no_headers: String,
    pub validate_error: String,
    pub validate_required: String,
    pub validate_min_length: String,
    pub validate_max_length: String,
    pub row_edit_flush_all: String,
    pub row_edit_retry_errors: String,
}

impl Default for GridLabels {
    fn default() -> Self {
        Self {
            sort_default: "Sort".to_string(),
            sort_asc: "Sort ascending".to_string(),
            sort_desc: "Sort descending".to_string(),
            group_column: "Group by this column".to_string(),
            ungroup_column: "Remove grouping".to_string(),
            group_collapse: "Collapse group".to_string(),
            group_expand: "Expand group".to_string(),
            tree_collapse: "Collapse row".to_string(),
            tree_expand: "Expand row".to_string(),
            expand_detail: "Expand details".to_string(),
            collapse_detail: "Collapse details".to_string(),
            filter_placeholder: "Filter…".to_string(),
            filter_disabled: "Filter disabled".to_string(),
            filter_column: "Filter".to_string(),
            pagination_previous: "Previous page".to_string(),
            pagination_next: "Next page".to_string(),
            pagination_page: "Page".to_string(),
            pagination_of: "of".to_string(),
            pagination_rows: "Rows per page".to_string(),
            empty_heading: "No matching rows".to_string(),
            empty_description: "Adjust the active filters, grouping, or sort order.".to_string(),
            toolbar_of: "of".to_string(),
            toolbar_rows: "rows".to_string(),
            stats_visible_rows: "visible rows".to_string(),
            group_rows_suffix: "rows".to_string(),
            pin_column: "Pin column".to_string(),
            pin_left: "Pin left".to_string(),
            pin_right: "Pin right".to_string(),
            unpin: "Unpin".to_string(),
            exporter_all_as_csv: "Export all data as csv".to_string(),
            exporter_visible_as_csv: "Export visible data as csv".to_string(),
            exporter_selected_as_csv: "Export selected data as csv".to_string(),
            exporter_all_as_pdf: "Export all data as pdf".to_string(),
            exporter_visible_as_pdf: "Export visible data as pdf".to_string(),
            exporter_selected_as_pdf: "Export selected data as pdf".to_string(),
            exporter_all_as_excel: "Export all data as excel".to_string(),
            exporter_visible_as_excel: "Export visible data as excel".to_string(),
            exporter_selected_as_excel: "Export selected data as excel".to_string(),
            importer_title: "Import".to_string(),
            importer_file_label: "File".to_string(),
            importer_invalid_json: "File could not be processed as JSON".to_string(),
            importer_json_not_array: "Import failed, file is not an array".to_string(),
            importer_invalid_csv: "File could not be processed as CSV".to_string(),
            importer_no_objects: "Objects could not be derived from the imported file".to_string(),
            importer_no_headers: "Column names could not be derived".to_string(),
            validate_error: "Error:".to_string(),
            validate_required: "Field required".to_string(),
            validate_min_length: "Value must be longer than or equal to THRESHOLD characters"
                .to_string(),
            validate_max_length: "Value must be shorter than or equal to THRESHOLD characters"
                .to_string(),
            row_edit_flush_all: "Save changes".to_string(),
            row_edit_retry_errors: "Retry errored rows".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridInfiniteScrollState {
    #[serde(default)]
    pub scroll_up: bool,
    #[serde(default)]
    pub scroll_down: bool,
    #[serde(default)]
    pub data_loading: bool,
    #[serde(default)]
    pub previous_visible_rows: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridOptions {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub data: Vec<GridRecord>,
    #[serde(default)]
    pub column_defs: Vec<GridColumnDef>,
    #[serde(default)]
    pub labels: GridLabels,
    #[serde(default)]
    pub icons: GridIcons,
    #[serde(default = "default_true")]
    pub enable_sorting: bool,
    #[serde(default = "default_true")]
    pub enable_filtering: bool,
    #[serde(default)]
    pub enable_grouping: bool,
    #[serde(default)]
    pub enable_column_moving: bool,
    #[serde(default = "default_true")]
    pub enable_column_resizing: bool,
    #[serde(default)]
    pub enable_cell_edit: bool,
    #[serde(default)]
    pub enable_cell_edit_on_focus: bool,
    #[serde(default = "default_true")]
    pub enable_virtualization: bool,
    #[serde(default)]
    pub enable_pagination: bool,
    #[serde(default = "default_true")]
    pub enable_pagination_controls: bool,
    #[serde(default)]
    pub use_external_pagination: bool,
    #[serde(default)]
    pub pagination_page_sizes: Vec<usize>,
    #[serde(default)]
    pub pagination_page_size: Option<usize>,
    #[serde(default)]
    pub pagination_current_page: Option<usize>,
    #[serde(default)]
    pub total_items: Option<usize>,
    #[serde(default)]
    pub enable_expandable: bool,
    #[serde(default)]
    pub has_expandable_row_template: bool,
    #[serde(default)]
    pub expandable_row_height: Option<usize>,
    #[serde(default)]
    pub expandable_row_header_width: Option<usize>,
    #[serde(default)]
    pub enable_tree_view: bool,
    #[serde(default)]
    pub tree_children_field: Option<String>,
    #[serde(default)]
    pub tree_indent: Option<usize>,
    #[serde(default = "default_true")]
    pub show_tree_expand_no_children: bool,
    #[serde(default)]
    pub tree_row_header_always_visible: bool,
    #[serde(default)]
    pub enable_auto_resize: bool,
    #[serde(default)]
    pub infinite_scroll_rows_from_end: Option<usize>,
    #[serde(default)]
    pub infinite_scroll_up: bool,
    #[serde(default)]
    pub infinite_scroll_down: Option<bool>,
    #[serde(default)]
    pub virtualization_threshold: Option<usize>,
    #[serde(default)]
    pub viewport_height: Option<usize>,
    #[serde(default)]
    pub grouping: Option<GridGroupingOptions>,
    #[serde(default)]
    pub enable_pinning: bool,
    #[serde(default)]
    pub enable_row_selection: Option<bool>,
    #[serde(default)]
    pub multi_select: Option<bool>,
    #[serde(default)]
    pub no_unselect: Option<bool>,
    #[serde(default)]
    pub modifier_keys_to_multi_select: Option<bool>,
    #[serde(default)]
    pub enable_row_header_selection: Option<bool>,
    #[serde(default)]
    pub enable_full_row_selection: Option<bool>,
    #[serde(default)]
    pub enable_focus_row_on_row_header_click: Option<bool>,
    #[serde(default)]
    pub enable_select_row_on_focus: Option<bool>,
    #[serde(default)]
    pub enable_select_all: Option<bool>,
    #[serde(default)]
    pub enable_selection_batch_event: Option<bool>,
    #[serde(default)]
    pub selection_row_header_width: Option<usize>,
    #[serde(default)]
    pub enable_footer_total_selected: Option<bool>,
    #[serde(default)]
    pub exporter_menu_item_order: Option<usize>,
    #[serde(default)]
    pub exporter_menu_csv: Option<bool>,
    #[serde(default)]
    pub exporter_menu_pdf: Option<bool>,
    #[serde(default)]
    pub exporter_menu_excel: Option<bool>,
    #[serde(default)]
    pub exporter_menu_all_data: Option<bool>,
    #[serde(default)]
    pub exporter_menu_visible_data: Option<bool>,
    #[serde(default)]
    pub exporter_menu_selected_data: Option<bool>,
    #[serde(default)]
    pub exporter_csv_column_separator: Option<String>,
    #[serde(default)]
    pub exporter_csv_filename: Option<String>,
    #[serde(default)]
    pub exporter_header_filter_use_name: Option<bool>,
    #[serde(default)]
    pub exporter_header_template: Option<String>,
    #[serde(default)]
    pub exporter_show_header: Option<bool>,
    #[serde(default)]
    pub exporter_suppress_columns: Option<Vec<String>>,
    #[serde(default)]
    pub exporter_older_excel_compatibility: Option<bool>,
    #[serde(default)]
    pub exporter_is_excel_compatible: Option<bool>,
    #[serde(default)]
    pub exporter_excel_filename: Option<String>,
    #[serde(default)]
    pub exporter_excel_sheet_name: Option<String>,
    #[serde(default)]
    pub exporter_excel_header: Option<Value>,
    #[serde(default)]
    pub exporter_column_scale_factor: Option<usize>,
    #[serde(default)]
    pub exporter_suppress_menu: Option<bool>,
    #[serde(default)]
    pub exporter_menu_label: Option<String>,
    #[serde(default)]
    pub exporter_pdf_filename: Option<String>,
    #[serde(default)]
    pub exporter_pdf_orientation: Option<String>,
    #[serde(default)]
    pub exporter_pdf_page_size: Option<String>,
    #[serde(default)]
    pub exporter_pdf_max_grid_width: Option<usize>,
    #[serde(default)]
    pub exporter_pdf_default_style: Option<Value>,
    #[serde(default)]
    pub exporter_pdf_table_style: Option<Value>,
    #[serde(default)]
    pub exporter_pdf_table_header_style: Option<Value>,
    #[serde(default)]
    pub exporter_pdf_layout: Option<Value>,
    #[serde(default)]
    pub exporter_pdf_header: Option<Value>,
    #[serde(default)]
    pub exporter_pdf_footer: Option<Value>,
    #[serde(default)]
    pub enable_importer: Option<bool>,
    #[serde(default)]
    pub importer_show_menu: Option<bool>,
    #[serde(default)]
    pub importer_menu_item_order: Option<usize>,
    #[serde(default)]
    pub row_edit_menu_item_order: Option<usize>,
    #[serde(default)]
    pub row_edit_menu_flush_dirty_rows: Option<bool>,
    #[serde(default)]
    pub row_edit_menu_cancel_dirty_rows: Option<bool>,
    #[serde(default)]
    pub row_id_field: Option<String>,
}

impl Default for GridOptions {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: None,
            data: Vec::new(),
            column_defs: Vec::new(),
            labels: GridLabels::default(),
            icons: GridIcons::default(),
            enable_sorting: true,
            enable_filtering: false,
            enable_grouping: false,
            enable_column_moving: false,
            enable_column_resizing: true,
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            enable_virtualization: true,
            enable_pagination: false,
            enable_pagination_controls: false,
            use_external_pagination: false,
            pagination_page_sizes: Vec::new(),
            pagination_page_size: None,
            pagination_current_page: None,
            total_items: None,
            enable_expandable: false,
            has_expandable_row_template: false,
            expandable_row_height: None,
            expandable_row_header_width: None,
            enable_tree_view: false,
            tree_children_field: None,
            tree_indent: None,
            show_tree_expand_no_children: false,
            tree_row_header_always_visible: false,
            enable_auto_resize: false,
            infinite_scroll_rows_from_end: None,
            infinite_scroll_up: false,
            infinite_scroll_down: None,
            virtualization_threshold: None,
            viewport_height: None,
            grouping: None,
            enable_pinning: false,
            enable_row_selection: None,
            multi_select: None,
            no_unselect: None,
            modifier_keys_to_multi_select: None,
            enable_row_header_selection: None,
            enable_full_row_selection: None,
            enable_focus_row_on_row_header_click: None,
            enable_select_row_on_focus: None,
            enable_select_all: None,
            enable_selection_batch_event: None,
            selection_row_header_width: None,
            enable_footer_total_selected: None,
            exporter_menu_item_order: None,
            exporter_menu_csv: None,
            exporter_menu_pdf: None,
            exporter_menu_excel: None,
            exporter_menu_all_data: None,
            exporter_menu_visible_data: None,
            exporter_menu_selected_data: None,
            exporter_csv_column_separator: None,
            exporter_csv_filename: None,
            exporter_header_filter_use_name: None,
            exporter_header_template: None,
            exporter_show_header: None,
            exporter_suppress_columns: None,
            exporter_older_excel_compatibility: None,
            exporter_is_excel_compatible: None,
            exporter_excel_filename: None,
            exporter_excel_sheet_name: None,
            exporter_excel_header: None,
            exporter_column_scale_factor: None,
            exporter_suppress_menu: None,
            exporter_menu_label: None,
            exporter_pdf_filename: None,
            exporter_pdf_orientation: None,
            exporter_pdf_page_size: None,
            exporter_pdf_max_grid_width: None,
            exporter_pdf_default_style: None,
            exporter_pdf_table_style: None,
            exporter_pdf_table_header_style: None,
            exporter_pdf_layout: None,
            exporter_pdf_header: None,
            exporter_pdf_footer: None,
            enable_importer: None,
            importer_show_menu: None,
            importer_menu_item_order: None,
            row_edit_menu_item_order: None,
            row_edit_menu_flush_dirty_rows: None,
            row_edit_menu_cancel_dirty_rows: None,
            row_id_field: Some("id".to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridCellPosition {
    pub row_id: String,
    pub column_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SortState {
    #[serde(default)]
    pub column_name: Option<String>,
    #[serde(default)]
    pub direction: SortDirection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridSavedPaginationState {
    pub pagination_current_page: usize,
    pub pagination_page_size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridSavedState {
    #[serde(default)]
    pub column_order: Vec<String>,
    #[serde(default)]
    pub filters: BTreeMap<String, String>,
    #[serde(default)]
    pub sort: Option<SortState>,
    #[serde(default)]
    pub grouping: Vec<String>,
    #[serde(default)]
    pub pagination: Option<GridSavedPaginationState>,
    #[serde(default)]
    pub expandable: BTreeMap<String, bool>,
    #[serde(default)]
    pub tree_view: BTreeMap<String, bool>,
    #[serde(default)]
    pub pinning: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridRow {
    pub id: String,
    pub entity: GridRecord,
    pub index: usize,
    pub height: usize,
    #[serde(default)]
    pub invisible_reasons: Vec<String>,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub is_selected: bool,
    #[serde(default)]
    pub is_focused: bool,
    #[serde(default = "default_true")]
    pub enable_selection: bool,
    #[serde(default)]
    pub tree_level: usize,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub has_children: bool,
    #[serde(default)]
    pub child_count: usize,
    #[serde(default)]
    pub expanded: bool,
    #[serde(default)]
    pub expanded_row_height: usize,
    #[serde(default)]
    pub is_dirty: bool,
    #[serde(default)]
    pub is_error: bool,
    #[serde(default)]
    pub is_saving: bool,
    #[serde(default = "default_true")]
    pub exporter_enable_exporting: bool,
}

impl GridRow {
    pub fn new(id: String, entity: GridRecord, index: usize, height: usize) -> Self {
        Self {
            id,
            entity,
            index,
            height,
            invisible_reasons: Vec::new(),
            visible: true,
            is_selected: false,
            is_focused: false,
            enable_selection: true,
            tree_level: 0,
            parent_id: None,
            has_children: false,
            child_count: 0,
            expanded: false,
            expanded_row_height: 0,
            is_dirty: false,
            is_error: false,
            is_saving: false,
            exporter_enable_exporting: true,
        }
    }

    pub fn set_this_row_invisible(&mut self, reason: impl Into<String>) {
        let reason = reason.into();
        if !self
            .invisible_reasons
            .iter()
            .any(|existing| existing == &reason)
        {
            self.invisible_reasons.push(reason);
        }
        self.visible = false;
    }

    pub fn clear_this_row_invisible(&mut self, reason: &str) {
        self.invisible_reasons.retain(|existing| existing != reason);
        self.visible = self.invisible_reasons.is_empty();
    }

    pub fn set_selected(&mut self, selected: bool) {
        self.is_selected = selected;
    }

    pub fn set_focused(&mut self, focused: bool) {
        self.is_focused = focused;
    }

    pub fn set_dirty(&mut self, dirty: bool) {
        self.is_dirty = dirty;
    }

    pub fn set_error(&mut self, error: bool) {
        self.is_error = error;
    }

    pub fn set_saving(&mut self, saving: bool) {
        self.is_saving = saving;
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupItem {
    pub id: String,
    pub depth: usize,
    pub field: String,
    pub label: String,
    pub count: usize,
    pub collapsed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowItem {
    pub id: String,
    pub row: GridRow,
    pub visible_index: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandableItem {
    pub id: String,
    pub row: GridRow,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DisplayItem {
    Group(GroupItem),
    Row(RowItem),
    Expandable(ExpandableItem),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildGridPipelineContext {
    pub options: GridOptions,
    #[serde(default)]
    pub columns: Vec<GridColumnDef>,
    #[serde(default)]
    pub active_filters: BTreeMap<String, String>,
    #[serde(default)]
    pub sort_state: SortState,
    #[serde(default)]
    pub group_by_columns: Vec<String>,
    #[serde(default)]
    pub collapsed_groups: BTreeMap<String, bool>,
    #[serde(default)]
    pub hidden_row_reasons: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub expanded_rows: BTreeMap<String, bool>,
    #[serde(default)]
    pub expanded_tree_rows: BTreeMap<String, bool>,
    #[serde(default = "default_current_page")]
    pub current_page: usize,
    #[serde(default)]
    pub page_size: usize,
    #[serde(default = "default_row_size")]
    pub row_size: usize,
}

fn default_current_page() -> usize {
    1
}

fn default_row_size() -> usize {
    44
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PipelineResult {
    #[serde(default)]
    pub visible_rows: Vec<GridRow>,
    #[serde(default)]
    pub display_items: Vec<DisplayItem>,
    #[serde(default)]
    pub virtualization_enabled: bool,
    #[serde(default)]
    pub pipeline_ms: f64,
    #[serde(default)]
    pub total_items: usize,
}
