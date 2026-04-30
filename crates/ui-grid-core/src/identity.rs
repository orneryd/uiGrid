use serde_json::Value;

use crate::{
    constants::SortDirection,
    models::{GridOptions, GridRow, SortState},
    utils::get_path_value,
};

pub fn find_grid_row_by_id(rows: &[GridRow], row_id: &str) -> Option<GridRow> {
    rows.iter()
        .find(|candidate| candidate.id == row_id)
        .cloned()
}

pub fn build_grid_sort_state(column_name: String, direction: Option<SortDirection>) -> SortState {
    SortState {
        column_name: Some(column_name),
        direction: direction.unwrap_or(SortDirection::Asc),
    }
}

pub fn resolve_grid_row_id(options: &GridOptions, row: &Value) -> String {
    if let Some(value) = row.as_str() {
        return value.to_string();
    }

    let row_id_field = options.row_id_field.as_deref().unwrap_or("id");
    if let Some(Value::String(id)) = get_path_value(row, row_id_field) {
        return id;
    }

    let row_index = options
        .data
        .iter()
        .position(|candidate| candidate == row)
        .unwrap_or(0);

    format!("{}-{}", options.id, row_index)
}
