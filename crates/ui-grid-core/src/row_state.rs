use std::collections::BTreeMap;

use crate::models::GridRow;

pub fn toggle_grid_row_expanded(
    expanded_rows: &BTreeMap<String, bool>,
    row_id: &str,
) -> (bool, BTreeMap<String, bool>) {
    let expanded = !expanded_rows.get(row_id).copied().unwrap_or(false);
    let mut next = expanded_rows.clone();
    next.insert(row_id.to_string(), expanded);
    (expanded, next)
}

pub fn expand_all_grid_rows(rows: &[GridRow]) -> BTreeMap<String, bool> {
    rows.iter().map(|row| (row.id.clone(), true)).collect()
}

pub fn are_all_grid_rows_expanded(rows: &[GridRow], expanded_rows: &BTreeMap<String, bool>) -> bool {
    rows.iter().all(|row| expanded_rows.get(&row.id).copied().unwrap_or(false))
}

pub fn set_grid_tree_row_expanded(
    expanded_tree_rows: &BTreeMap<String, bool>,
    row_id: &str,
    expanded: bool,
) -> BTreeMap<String, bool> {
    let mut next = expanded_tree_rows.clone();
    next.insert(row_id.to_string(), expanded);
    next
}

pub fn toggle_grid_tree_row_expanded(
    expanded_tree_rows: &BTreeMap<String, bool>,
    row_id: &str,
) -> (bool, BTreeMap<String, bool>) {
    let expanded = !expanded_tree_rows.get(row_id).copied().unwrap_or(false);
    (expanded, set_grid_tree_row_expanded(expanded_tree_rows, row_id, expanded))
}

pub fn expand_all_grid_tree_rows(rows: &[GridRow]) -> BTreeMap<String, bool> {
    rows.iter()
        .filter(|row| row.has_children)
        .map(|row| (row.id.clone(), true))
        .collect()
}

pub fn get_grid_tree_row_children(rows: &[GridRow], row_id: &str) -> Vec<GridRow> {
    rows.iter()
        .filter(|candidate| candidate.parent_id.as_deref() == Some(row_id))
        .cloned()
        .collect()
}

pub fn add_grid_row_invisible_reason(
    hidden_row_reasons: &BTreeMap<String, Vec<String>>,
    row_id: &str,
    reason: &str,
) -> BTreeMap<String, Vec<String>> {
    let mut next = hidden_row_reasons.clone();
    let reasons = next.entry(row_id.to_string()).or_default();
    if !reasons.iter().any(|existing| existing == reason) {
        reasons.push(reason.to_string());
    }
    next
}

pub fn clear_grid_row_invisible_reason(
    hidden_row_reasons: &BTreeMap<String, Vec<String>>,
    row_id: &str,
    reason: &str,
) -> BTreeMap<String, Vec<String>> {
    let mut next = hidden_row_reasons.clone();
    if let Some(reasons) = next.get_mut(row_id) {
        reasons.retain(|existing| existing != reason);
        if reasons.is_empty() {
            next.remove(row_id);
        }
    }
    next
}