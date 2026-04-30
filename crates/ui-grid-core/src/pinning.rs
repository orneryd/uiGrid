use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::models::{GridColumnDef, GridLabels, GridOptions};

pub type PinnedColumnState = BTreeMap<String, String>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PinDirection {
    Left,
    Right,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedOffset {
    pub side: String,
    pub offset: String,
}

pub fn is_pinning_enabled(options: &GridOptions) -> bool {
    options.enable_pinning
}

pub fn is_column_pinnable(options: &GridOptions, column: &GridColumnDef) -> bool {
    is_pinning_enabled(options) && column.enable_pinning
}

pub fn get_column_pin_direction(
    pinned_columns: &PinnedColumnState,
    column: &GridColumnDef,
) -> PinDirection {
    match pinned_columns.get(&column.name).map(String::as_str) {
        Some("left") => PinDirection::Left,
        Some("right") => PinDirection::Right,
        _ => PinDirection::None,
    }
}

pub fn pin_column_state(
    current: &PinnedColumnState,
    column_name: &str,
    direction: PinDirection,
) -> PinnedColumnState {
    let mut next = current.clone();
    match direction {
        PinDirection::None => {
            next.remove(column_name);
        }
        PinDirection::Left => {
            next.insert(column_name.to_string(), "left".to_string());
        }
        PinDirection::Right => {
            next.insert(column_name.to_string(), "right".to_string());
        }
    }
    next
}

pub fn build_initial_pinned_state(columns: &[GridColumnDef]) -> PinnedColumnState {
    let mut state = PinnedColumnState::new();
    for column in columns {
        if column.pinned_left {
            state.insert(column.name.clone(), "left".to_string());
        } else if column.pinned_right {
            state.insert(column.name.clone(), "right".to_string());
        }
    }
    state
}

pub fn compute_pinned_offset(
    visible_columns: &[GridColumnDef],
    pinned_columns: &PinnedColumnState,
    column: &GridColumnDef,
) -> Option<PinnedOffset> {
    let direction = pinned_columns.get(&column.name)?;

    fn resolve_column_width_for_offset(column: &GridColumnDef) -> String {
        let Some(width) = &column.width else {
            return "11rem".to_string();
        };

        if width.contains("fr") || width.contains("minmax") {
            return "11rem".to_string();
        }

        width.clone()
    }

    if direction == "left" {
        let mut offset_parts = Vec::new();
        for current in visible_columns {
            if current.name == column.name {
                break;
            }
            if pinned_columns
                .get(&current.name)
                .is_some_and(|side| side == "left")
            {
                offset_parts.push(resolve_column_width_for_offset(current));
            }
        }

        return Some(PinnedOffset {
            side: "left".to_string(),
            offset: if offset_parts.is_empty() {
                "0px".to_string()
            } else {
                format!("calc({})", offset_parts.join(" + "))
            },
        });
    }

    if direction == "right" {
        let mut offset_parts = Vec::new();
        for current in visible_columns.iter().rev() {
            if current.name == column.name {
                break;
            }
            if pinned_columns
                .get(&current.name)
                .is_some_and(|side| side == "right")
            {
                offset_parts.push(resolve_column_width_for_offset(current));
            }
        }

        return Some(PinnedOffset {
            side: "right".to_string(),
            offset: if offset_parts.is_empty() {
                "0px".to_string()
            } else {
                format!("calc({})", offset_parts.join(" + "))
            },
        });
    }

    None
}

pub fn pinning_button_label(
    pinned_columns: &PinnedColumnState,
    column: &GridColumnDef,
    labels: &GridLabels,
) -> String {
    match pinned_columns.get(&column.name).map(String::as_str) {
        Some("left") | Some("right") => labels.unpin.clone(),
        _ => labels.pin_left.clone(),
    }
}
