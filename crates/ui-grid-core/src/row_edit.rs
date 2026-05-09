use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::models::{GridRecord, GridRow};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridRowEditState {
    #[serde(default)]
    pub dirty_row_ids: BTreeSet<String>,
    #[serde(default)]
    pub error_row_ids: BTreeSet<String>,
    #[serde(default)]
    pub saving_row_ids: BTreeSet<String>,
    #[serde(default)]
    pub save_promise_row_ids: BTreeSet<String>,
}

pub fn create_grid_row_edit_state() -> GridRowEditState {
    GridRowEditState::default()
}

pub fn mark_grid_row_dirty(state: &mut GridRowEditState, row: &mut GridRow) -> bool {
    if row.is_dirty {
        return false;
    }
    row.set_dirty(true);
    row.set_error(false);
    state.dirty_row_ids.insert(row.id.clone());
    state.error_row_ids.remove(&row.id);
    true
}

pub fn mark_grid_row_clean(state: &mut GridRowEditState, row: &mut GridRow) {
    row.set_dirty(false);
    row.set_error(false);
    row.set_saving(false);
    state.dirty_row_ids.remove(&row.id);
    state.error_row_ids.remove(&row.id);
    state.saving_row_ids.remove(&row.id);
    state.save_promise_row_ids.remove(&row.id);
}

pub fn mark_grid_row_saving(state: &mut GridRowEditState, row: &mut GridRow) {
    row.set_saving(true);
    state.saving_row_ids.insert(row.id.clone());
}

pub fn mark_grid_row_error(state: &mut GridRowEditState, row: &mut GridRow) {
    row.set_saving(false);
    row.set_error(true);
    row.set_dirty(true);
    state.saving_row_ids.remove(&row.id);
    state.error_row_ids.insert(row.id.clone());
    state.dirty_row_ids.insert(row.id.clone());
    state.save_promise_row_ids.remove(&row.id);
}

pub fn is_grid_row_edit_timer_enabled(wait_interval: Option<i32>) -> bool {
    wait_interval != Some(-1)
}

pub fn resolve_grid_row_edit_wait_interval(wait_interval: Option<i32>) -> i32 {
    match wait_interval {
        Some(value) if value > 0 => value,
        _ => 2000,
    }
}

pub fn collect_grid_row_entities(rows: &[GridRow], ids: &BTreeSet<String>) -> Vec<GridRecord> {
    rows.iter()
        .filter(|row| ids.contains(&row.id))
        .map(|row| row.entity.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn make_row(id: &str) -> GridRow {
        GridRow::new(id.to_string(), json!({ "id": id }), 0, 44)
    }

    #[test]
    fn marks_row_dirty_once() {
        let mut state = create_grid_row_edit_state();
        let mut row = make_row("r1");

        assert!(mark_grid_row_dirty(&mut state, &mut row));
        assert!(!mark_grid_row_dirty(&mut state, &mut row));
        assert!(row.is_dirty);
        assert!(state.dirty_row_ids.contains("r1"));
    }

    #[test]
    fn marks_row_error_and_preserves_dirty() {
        let mut state = create_grid_row_edit_state();
        let mut row = make_row("r1");
        mark_grid_row_dirty(&mut state, &mut row);
        mark_grid_row_saving(&mut state, &mut row);

        mark_grid_row_error(&mut state, &mut row);

        assert!(row.is_error);
        assert!(row.is_dirty);
        assert!(!row.is_saving);
        assert!(state.error_row_ids.contains("r1"));
        assert!(!state.saving_row_ids.contains("r1"));
    }

    #[test]
    fn resolves_default_wait_interval() {
        assert_eq!(resolve_grid_row_edit_wait_interval(None), 2000);
        assert_eq!(resolve_grid_row_edit_wait_interval(Some(-1)), 2000);
        assert_eq!(resolve_grid_row_edit_wait_interval(Some(4000)), 4000);
    }
}
