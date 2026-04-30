use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    constants::SortDirection,
    models::{GridSavedPaginationState, GridSavedState, SortState},
};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildGridSavedStateContext {
    pub column_order: Vec<String>,
    pub active_filters: BTreeMap<String, String>,
    pub sort_state: SortState,
    pub group_by_columns: Vec<String>,
    pub current_page: usize,
    pub page_size: usize,
    pub total_items: usize,
    pub expanded_rows: BTreeMap<String, bool>,
    pub expanded_tree_rows: BTreeMap<String, bool>,
    #[serde(default)]
    pub pinned_columns: BTreeMap<String, String>,
}

pub fn build_grid_saved_state(context: BuildGridSavedStateContext) -> GridSavedState {
    GridSavedState {
        column_order: context.column_order,
        filters: context.active_filters,
        sort: Some(context.sort_state),
        grouping: context.group_by_columns,
        pagination: Some(GridSavedPaginationState {
            pagination_current_page: current_page_value(context.current_page),
            pagination_page_size: effective_page_size(context.page_size, context.total_items),
        }),
        expandable: context.expanded_rows,
        tree_view: context.expanded_tree_rows,
        pinning: context.pinned_columns,
    }
}

pub fn normalize_grid_saved_state(value: &Value) -> GridSavedState {
    let mut normalized = GridSavedState::default();
    let Some(state) = value.as_object() else {
        return normalized;
    };

    if let Some(Value::Array(column_order)) = state.get("columnOrder") {
        normalized.column_order = column_order
            .iter()
            .filter_map(|value| value.as_str())
            .filter(|value| is_safe_state_key(value))
            .map(ToOwned::to_owned)
            .collect();
    }

    if let Some(Value::Object(filters)) = state.get("filters") {
        normalized.filters = filters
            .iter()
            .filter_map(|(key, value)| {
                let string_value = value.as_str()?;
                is_safe_state_key(key).then(|| (key.clone(), string_value.to_string()))
            })
            .collect();
    }

    if let Some(Value::Object(sort)) = state.get("sort") {
        normalized.sort = Some(SortState {
            column_name: sort
                .get("columnName")
                .and_then(Value::as_str)
                .filter(|value| is_safe_state_key(value))
                .map(ToOwned::to_owned),
            direction: match sort.get("direction").and_then(Value::as_str) {
                Some("asc") => SortDirection::Asc,
                Some("desc") => SortDirection::Desc,
                _ => SortDirection::None,
            },
        });
    }

    if let Some(Value::Array(grouping)) = state.get("grouping") {
        normalized.grouping = grouping
            .iter()
            .filter_map(Value::as_str)
            .filter(|value| is_safe_state_key(value))
            .map(ToOwned::to_owned)
            .collect();
    }

    if let Some(Value::Object(pagination)) = state.get("pagination") {
        normalized.pagination = Some(GridSavedPaginationState {
            pagination_current_page: pagination
                .get("paginationCurrentPage")
                .and_then(Value::as_u64)
                .map(|value| value.max(1) as usize)
                .unwrap_or(1),
            pagination_page_size: pagination
                .get("paginationPageSize")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
                .unwrap_or(0),
        });
    }

    if let Some(Value::Object(expandable)) = state.get("expandable") {
        normalized.expandable = normalize_boolean_map(expandable);
    }

    if let Some(Value::Object(tree_view)) = state.get("treeView") {
        normalized.tree_view = normalize_boolean_map(tree_view);
    }

    if let Some(Value::Object(pinning)) = state.get("pinning") {
        normalized.pinning = pinning
            .iter()
            .filter_map(|(key, value)| match value.as_str() {
                Some("left") | Some("right") if is_safe_state_key(key) => {
                    Some((key.clone(), value.as_str().unwrap().to_string()))
                }
                _ => None,
            })
            .collect();
    }

    normalized
}

fn current_page_value(current_page: usize) -> usize {
    current_page.max(1)
}

fn effective_page_size(page_size: usize, total_items: usize) -> usize {
    if page_size > 0 {
        page_size
    } else {
        total_items
    }
}

pub fn sanitize_download_filename(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "ui-grid".to_string()
    } else {
        trimmed
    }
}

pub fn normalize_boolean_map(value: &serde_json::Map<String, Value>) -> BTreeMap<String, bool> {
    value
        .iter()
        .filter_map(|(key, entry)| {
            let boolean = entry.as_bool()?;
            is_safe_state_key(key).then(|| (key.clone(), boolean))
        })
        .collect()
}

pub fn is_safe_state_key(value: &str) -> bool {
    !matches!(value, "__proto__" | "constructor" | "prototype")
}
