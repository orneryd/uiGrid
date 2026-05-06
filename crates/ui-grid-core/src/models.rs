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
            tree_level: 0,
            parent_id: None,
            has_children: false,
            child_count: 0,
            expanded: false,
            expanded_row_height: 0,
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
