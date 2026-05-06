use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Version of the host-neutral engine contract shared across wrappers.
pub const ENGINE_CONTRACT_VERSION: &str = "0.1.0";
/// Version of the exported C ABI symbol and ownership contract.
pub const C_ABI_VERSION: &str = "0.1.0";
/// Version of the JSON projection payload returned by foreign wrappers.
pub const PROJECTION_SCHEMA_VERSION: &str = "0.1.0";
/// Version of the JSON command payload accepted by foreign wrappers.
pub const COMMAND_SCHEMA_VERSION: &str = "0.1.0";

/// Sort command DTO accepted by the foreign-command surface.
///
/// JSON shape:
/// `{"kind":"setSort","columnName":"price","direction":"asc"}`
///
/// Supported directions are `none`, `asc`, and `desc`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiGridSortCommand {
    pub column_name: Option<String>,
    pub direction: String,
}

/// Grouping command DTO accepted by the foreign-command surface.
///
/// JSON shape:
/// `{"kind":"setGrouping","groupBy":["sector","status"]}`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiGridGroupingCommand {
    pub group_by: Vec<String>,
}

/// Pinning command DTO accepted by the foreign-command surface.
///
/// JSON shape:
/// `{"kind":"setPinnedColumns","pinnedColumns":{"symbol":"left"}}`
///
/// Values are host-facing pin targets such as `left`, `center`, or `right`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiGridPinnedColumnsCommand {
    pub pinned_columns: BTreeMap<String, String>,
}

/// Column-order command DTO accepted by the foreign-command surface.
///
/// JSON shape:
/// `{"kind":"setColumnOrder","columnOrder":["symbol","price","change"]}`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiGridColumnOrderCommand {
    pub column_order: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum UiGridEngineCommand {
    SetFilter {
        column_name: String,
        value: String,
    },
    ClearFilters,
    SetSort {
        #[serde(flatten)]
        sort: UiGridSortCommand,
    },
    SetGrouping {
        #[serde(flatten)]
        grouping: UiGridGroupingCommand,
    },
    SetPagination {
        current_page: usize,
        page_size: usize,
    },
    SetCollapsedGroups {
        collapsed_groups: BTreeMap<String, bool>,
    },
    SetExpandedRows {
        expanded_rows: BTreeMap<String, bool>,
    },
    SetExpandedTreeRows {
        expanded_tree_rows: BTreeMap<String, bool>,
    },
    SetPinnedColumns {
        #[serde(flatten)]
        pinning: UiGridPinnedColumnsCommand,
    },
    SetColumnOrder {
        #[serde(flatten)]
        order: UiGridColumnOrderCommand,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Versioned JSON envelope returned by foreign wrappers.
pub struct UiGridProjectionEnvelope<T> {
    pub engine_contract_version: String,
    pub c_abi_version: String,
    pub projection_schema_version: String,
    pub command_schema_version: String,
    pub payload: T,
}
