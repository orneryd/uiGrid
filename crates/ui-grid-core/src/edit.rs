use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};

use crate::models::{GridCellPosition, GridColumnDef, GridColumnType, GridOptions, GridRow};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GridMoveDirection {
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridEditSession {
    pub focused_cell: GridCellPosition,
    pub editing_cell: GridCellPosition,
    pub editing_value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridFocusCellResult {
    pub focused_cell: GridCellPosition,
    pub should_begin_edit: bool,
}

pub fn is_grid_cell_position(
    position: Option<&GridCellPosition>,
    row_id: &str,
    column_name: &str,
) -> bool {
    position
        .is_some_and(|position| position.row_id == row_id && position.column_name == column_name)
}

pub fn begin_grid_edit_session(
    row_id: impl Into<String>,
    column_name: impl Into<String>,
    editing_value: impl Into<String>,
) -> GridEditSession {
    let position = GridCellPosition {
        row_id: row_id.into(),
        column_name: column_name.into(),
    };

    GridEditSession {
        focused_cell: position.clone(),
        editing_cell: position,
        editing_value: editing_value.into(),
    }
}

pub fn should_grid_edit_on_focus(options: &GridOptions, column: &GridColumnDef) -> bool {
    column.enable_cell_edit_on_focus || options.enable_cell_edit_on_focus
}

pub fn build_grid_focus_cell_result(
    current_focused_cell: Option<&GridCellPosition>,
    current_editing_cell: Option<&GridCellPosition>,
    row_id: impl Into<String>,
    column_name: impl Into<String>,
    should_edit_on_focus: bool,
    is_cell_editable: bool,
) -> GridFocusCellResult {
    let focused_cell = GridCellPosition {
        row_id: row_id.into(),
        column_name: column_name.into(),
    };

    let should_begin_edit = should_edit_on_focus
        && is_cell_editable
        && !is_grid_cell_position(
            current_focused_cell,
            &focused_cell.row_id,
            &focused_cell.column_name,
        )
        && !is_grid_cell_position(
            current_editing_cell,
            &focused_cell.row_id,
            &focused_cell.column_name,
        );

    GridFocusCellResult {
        focused_cell,
        should_begin_edit,
    }
}

pub fn clear_grid_edit_session() -> (Option<GridCellPosition>, String) {
    (None, String::new())
}

pub fn find_next_grid_cell<F>(
    rows: &[GridRow],
    columns: &[GridColumnDef],
    row_id: &str,
    column_name: &str,
    direction: GridMoveDirection,
    is_cell_allowed: Option<F>,
) -> Option<GridCellPosition>
where
    F: Fn(&GridRow, &GridColumnDef) -> bool,
{
    let row_index = rows.iter().position(|candidate| candidate.id == row_id)?;
    let column_index = columns
        .iter()
        .position(|candidate| candidate.name == column_name)?;

    let mut next_row_index = row_index as isize;
    let mut next_column_index = column_index as isize;

    loop {
        match direction {
            GridMoveDirection::Left => {
                next_column_index -= 1;
                if next_column_index < 0 {
                    next_row_index -= 1;
                    next_column_index = columns.len() as isize - 1;
                }
            }
            GridMoveDirection::Right => {
                next_column_index += 1;
                if next_column_index >= columns.len() as isize {
                    next_row_index += 1;
                    next_column_index = 0;
                }
            }
            GridMoveDirection::Up => next_row_index -= 1,
            GridMoveDirection::Down => next_row_index += 1,
        }

        if next_row_index < 0
            || next_row_index >= rows.len() as isize
            || next_column_index < 0
            || next_column_index >= columns.len() as isize
        {
            return None;
        }

        let next_row = &rows[next_row_index as usize];
        let next_column = &columns[next_column_index as usize];
        let allowed = is_cell_allowed
            .as_ref()
            .is_none_or(|predicate| predicate(next_row, next_column));
        if allowed {
            return Some(GridCellPosition {
                row_id: next_row.id.clone(),
                column_name: next_column.name.clone(),
            });
        }
    }
}

pub fn stringify_grid_editor_value(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        other => other.to_string(),
    }
}

pub fn parse_grid_edited_value(column: &GridColumnDef, value: &str, old_value: &Value) -> Value {
    match column.r#type {
        GridColumnType::Number => value
            .parse::<f64>()
            .ok()
            .filter(|parsed| parsed.is_finite())
            .and_then(Number::from_f64)
            .map(Value::Number)
            .unwrap_or_else(|| old_value.clone()),
        GridColumnType::Boolean => Value::Bool(value == "true"),
        GridColumnType::Date | GridColumnType::String | GridColumnType::Object => {
            Value::String(value.to_string())
        }
    }
}

pub fn is_printable_grid_key(key: &str, ctrl_key: bool, meta_key: bool, alt_key: bool) -> bool {
    key.chars().count() == 1 && !ctrl_key && !meta_key && !alt_key
}
