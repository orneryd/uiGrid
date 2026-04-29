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
    pub sort: Option<GridSortDescriptor>,
    #[serde(default)]
    pub filter: Option<GridFilterDescriptor>,
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
    #[serde(default = "default_true")]
    pub enable_sorting: bool,
    #[serde(default = "default_true")]
    pub enable_filtering: bool,
    #[serde(default)]
    pub enable_grouping: bool,
    #[serde(default = "default_true")]
    pub enable_virtualization: bool,
    #[serde(default)]
    pub enable_pagination: bool,
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
    pub enable_tree_view: bool,
    #[serde(default)]
    pub tree_children_field: Option<String>,
    #[serde(default)]
    pub virtualization_threshold: Option<usize>,
    #[serde(default)]
    pub grouping: Option<GridGroupingOptions>,
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
            enable_sorting: true,
            enable_filtering: true,
            enable_grouping: false,
            enable_virtualization: true,
            enable_pagination: false,
            use_external_pagination: false,
            pagination_page_sizes: Vec::new(),
            pagination_page_size: None,
            pagination_current_page: None,
            total_items: None,
            enable_expandable: false,
            expandable_row_height: None,
            enable_tree_view: false,
            tree_children_field: None,
            virtualization_threshold: Some(40),
            grouping: None,
            row_id_field: Some("id".to_string()),
        }
    }
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
