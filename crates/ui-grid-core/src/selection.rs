use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{GridOptions, GridRecord, GridRow};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridSelectionState {
    #[serde(default)]
    pub selected_row_ids: BTreeSet<String>,
    #[serde(default)]
    pub last_selected_row_id: Option<String>,
    #[serde(default)]
    pub focused_row_id: Option<String>,
    #[serde(default)]
    pub select_all: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSelectionResolvedOptions {
    pub enable_row_selection: bool,
    pub multi_select: bool,
    pub no_unselect: bool,
    pub modifier_keys_to_multi_select: bool,
    pub enable_row_header_selection: bool,
    pub enable_full_row_selection: bool,
    pub enable_focus_row_on_row_header_click: bool,
    pub enable_select_row_on_focus: bool,
    pub enable_select_all: bool,
    pub enable_selection_batch_event: bool,
    pub selection_row_header_width: usize,
    pub enable_footer_total_selected: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SelectionChange {
    #[serde(default)]
    pub changed: Vec<GridRow>,
    pub select_all_after: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleGridRowSelectionOptions {
    pub multi_select: bool,
    pub no_unselect: bool,
    #[serde(default = "default_true")]
    pub can_be_invisible: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftGridRowSelectionOptions {
    pub multi_select: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectAllGridRowsOptions {
    pub multi_select: bool,
}

fn default_true() -> bool {
    true
}

pub fn create_grid_selection_state() -> GridSelectionState {
    GridSelectionState::default()
}

pub fn resolve_grid_selection_options(options: &GridOptions) -> GridSelectionResolvedOptions {
    let enable_row_header_selection = options.enable_row_header_selection.unwrap_or(true);
    GridSelectionResolvedOptions {
        enable_row_selection: options.enable_row_selection.unwrap_or(false),
        multi_select: options.multi_select.unwrap_or(true),
        no_unselect: options.no_unselect.unwrap_or(false),
        modifier_keys_to_multi_select: options.modifier_keys_to_multi_select.unwrap_or(false),
        enable_row_header_selection,
        enable_full_row_selection: options
            .enable_full_row_selection
            .unwrap_or(!enable_row_header_selection),
        enable_focus_row_on_row_header_click: options
            .enable_focus_row_on_row_header_click
            .unwrap_or(true)
            || !enable_row_header_selection,
        enable_select_row_on_focus: options.enable_select_row_on_focus.unwrap_or(true),
        enable_select_all: options.enable_select_all.unwrap_or(true),
        enable_selection_batch_event: options.enable_selection_batch_event.unwrap_or(true),
        selection_row_header_width: options.selection_row_header_width.unwrap_or(30),
        enable_footer_total_selected: options.enable_footer_total_selected.unwrap_or(true),
    }
}

pub fn toggle_grid_row_selection(
    state: &mut GridSelectionState,
    all_rows: &mut [GridRow],
    row_id: &str,
    opts: &ToggleGridRowSelectionOptions,
) -> SelectionChange {
    let Some(target_index) = all_rows.iter().position(|row| row.id == row_id) else {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    };
    if !all_rows[target_index].enable_selection {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    }

    let mut changed = Vec::new();
    let mut selected = all_rows[target_index].is_selected;

    if !opts.multi_select {
        if !selected {
            for row in all_rows.iter_mut() {
                if row.is_selected && row.enable_selection {
                    row.set_selected(false);
                    state.selected_row_ids.remove(&row.id);
                    changed.push(row.clone());
                }
            }
        } else if state.selected_row_ids.len() > 1 {
            selected = false;
            for row in all_rows.iter_mut() {
                if row.is_selected && row.enable_selection {
                    row.set_selected(false);
                    state.selected_row_ids.remove(&row.id);
                    changed.push(row.clone());
                }
            }
        }
    }

    if !(selected && opts.no_unselect) && (opts.can_be_invisible || all_rows[target_index].visible)
    {
        let next = !selected;
        let row = &mut all_rows[target_index];
        row.set_selected(next);
        if next {
            state.selected_row_ids.insert(row.id.clone());
            state.last_selected_row_id = Some(row.id.clone());
        } else {
            state.selected_row_ids.remove(&row.id);
        }
        changed.push(row.clone());
    }

    let select_all_after = !all_rows.is_empty() && state.selected_row_ids.len() == all_rows.len();
    state.select_all = select_all_after;
    SelectionChange {
        changed,
        select_all_after,
    }
}

pub fn shift_grid_row_selection(
    state: &mut GridSelectionState,
    visible_row_cache: &mut [GridRow],
    row_id: &str,
    opts: &ShiftGridRowSelectionOptions,
) -> SelectionChange {
    if !opts.multi_select {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    }

    let anchor_index = state.last_selected_row_id.as_ref().and_then(|anchor_id| {
        visible_row_cache
            .iter()
            .position(|row| &row.id == anchor_id)
    });
    let mut from_row = if !state.selected_row_ids.is_empty() {
        anchor_index.unwrap_or(0)
    } else {
        0
    };
    let Some(mut to_row) = visible_row_cache.iter().position(|row| row.id == row_id) else {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    };

    if from_row > to_row {
        std::mem::swap(&mut from_row, &mut to_row);
    }

    let mut changed = Vec::new();
    for row in visible_row_cache.iter_mut().take(to_row + 1).skip(from_row) {
        if row.is_selected || !row.enable_selection {
            continue;
        }
        row.set_selected(true);
        state.selected_row_ids.insert(row.id.clone());
        state.last_selected_row_id = Some(row.id.clone());
        changed.push(row.clone());
    }

    let select_all_after =
        !visible_row_cache.is_empty() && state.selected_row_ids.len() == visible_row_cache.len();
    state.select_all = select_all_after;
    SelectionChange {
        changed,
        select_all_after,
    }
}

pub fn select_all_grid_rows(
    state: &mut GridSelectionState,
    all_rows: &mut [GridRow],
    opts: &SelectAllGridRowsOptions,
) -> SelectionChange {
    if !opts.multi_select {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    }

    let mut changed = Vec::new();
    for row in all_rows.iter_mut() {
        if row.is_selected || !row.enable_selection {
            continue;
        }
        row.set_selected(true);
        state.selected_row_ids.insert(row.id.clone());
        changed.push(row.clone());
    }
    state.select_all = true;
    SelectionChange {
        changed,
        select_all_after: true,
    }
}

pub fn select_all_visible_grid_rows(
    state: &mut GridSelectionState,
    all_rows: &mut [GridRow],
    opts: &SelectAllGridRowsOptions,
) -> SelectionChange {
    if !opts.multi_select {
        return SelectionChange {
            changed: Vec::new(),
            select_all_after: state.select_all,
        };
    }

    let mut changed = Vec::new();
    for row in all_rows.iter_mut() {
        if row.visible {
            if row.is_selected || !row.enable_selection {
                continue;
            }
            row.set_selected(true);
            state.selected_row_ids.insert(row.id.clone());
            changed.push(row.clone());
        } else if row.is_selected {
            row.set_selected(false);
            state.selected_row_ids.remove(&row.id);
            changed.push(row.clone());
        }
    }
    state.select_all = true;
    SelectionChange {
        changed,
        select_all_after: true,
    }
}

pub fn clear_all_grid_selection(
    state: &mut GridSelectionState,
    all_rows: &mut [GridRow],
) -> SelectionChange {
    let mut changed = Vec::new();
    for row in all_rows.iter_mut() {
        if row.is_selected && row.enable_selection {
            row.set_selected(false);
            state.selected_row_ids.remove(&row.id);
            changed.push(row.clone());
        }
    }
    state.select_all = false;
    SelectionChange {
        changed,
        select_all_after: false,
    }
}

pub fn find_grid_row_by_key(
    rows: &[GridRow],
    is_in_entity: bool,
    key: &str,
    comparator: &Value,
) -> Option<GridRow> {
    rows.iter().find_map(|row| {
        let matches = if is_in_entity {
            row.entity.get(key) == Some(comparator)
        } else {
            serde_json::to_value(row)
                .ok()
                .and_then(|value| value.get(key).cloned())
                .as_ref()
                == Some(comparator)
        };
        if matches { Some(row.clone()) } else { None }
    })
}

pub fn reconcile_grid_selection(state: &mut GridSelectionState, all_rows: &mut [GridRow]) {
    let mut alive = BTreeSet::new();
    for row in all_rows.iter_mut() {
        if state.selected_row_ids.contains(&row.id) {
            row.set_selected(true);
            alive.insert(row.id.clone());
        } else {
            row.set_selected(false);
        }
        row.set_focused(state.focused_row_id.as_deref() == Some(row.id.as_str()));
    }
    state.selected_row_ids.retain(|id| alive.contains(id));
    state.select_all = !all_rows.is_empty() && state.selected_row_ids.len() == all_rows.len();
}

pub fn map_selected_rows_to_entities(rows: &[GridRow]) -> Vec<GridRecord> {
    rows.iter()
        .filter(|row| row.entity.is_object())
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
    fn resolves_documented_defaults() {
        let resolved = resolve_grid_selection_options(&GridOptions {
            id: "grid".to_string(),
            ..Default::default()
        });
        assert!(!resolved.enable_row_selection);
        assert!(resolved.multi_select);
        assert!(resolved.enable_row_header_selection);
        assert!(!resolved.enable_full_row_selection);
        assert_eq!(resolved.selection_row_header_width, 30);
    }

    #[test]
    fn toggles_and_tracks_selection() {
        let mut state = create_grid_selection_state();
        let mut rows = vec![make_row("r1"), make_row("r2")];
        let change = toggle_grid_row_selection(
            &mut state,
            &mut rows,
            "r1",
            &ToggleGridRowSelectionOptions {
                multi_select: true,
                no_unselect: false,
                can_be_invisible: true,
            },
        );

        assert_eq!(change.changed.len(), 1);
        assert!(rows[0].is_selected);
        assert!(state.selected_row_ids.contains("r1"));
        assert_eq!(state.last_selected_row_id.as_deref(), Some("r1"));
    }

    #[test]
    fn reconcile_prunes_stale_ids_and_sets_focus() {
        let mut state = create_grid_selection_state();
        state.selected_row_ids.insert("r1".to_string());
        state.selected_row_ids.insert("gone".to_string());
        state.focused_row_id = Some("r1".to_string());
        let mut rows = vec![make_row("r1"), make_row("r2")];

        reconcile_grid_selection(&mut state, &mut rows);

        assert!(rows[0].is_selected);
        assert!(rows[0].is_focused);
        assert!(!state.selected_row_ids.contains("gone"));
    }
}
