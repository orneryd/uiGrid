use serde_json::{Map as JsonMap, Value};
use ui_grid_core::models::{GridColumnDef, GridColumnType};

fn col(name: &str, display: &str, col_type: GridColumnType, editable: bool) -> GridColumnDef {
    GridColumnDef {
        name: name.into(),
        display_name: Some(display.into()),
        field: Some(name.into()),
        r#type: col_type,
        visible: true,
        sortable: true,
        filterable: true,
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: true,
        enable_pinning: true,
        enable_cell_edit: editable,
        ..GridColumnDef::default()
    }
}

/// Attach a min-length validator (built into the core registry) to a
/// column. The grid runs this on every cell commit and stamps
/// `$$invalid<col>` on the entity when the value is shorter than the
/// threshold; the egui adapter's validation chrome paints the red
/// border + tooltip from there.
fn with_min_length(mut column: GridColumnDef, min: usize) -> GridColumnDef {
    let mut validators = JsonMap::new();
    validators.insert("minLength".to_string(), Value::Number((min as u64).into()));
    column.validators = Some(validators);
    column
}

pub fn flat_columns() -> Vec<GridColumnDef> {
    vec![
        col("account_id", "Account", GridColumnType::String, false),
        // Owner gains a 3-character min-length rule so the demo can
        // exercise the validation chrome end-to-end (red border + the
        // joined tooltip on hover).
        with_min_length(col("owner", "Owner", GridColumnType::String, true), 3),
        col("status", "Status", GridColumnType::String, true),
        col("manager", "Manager", GridColumnType::String, true),
        col("region", "Region", GridColumnType::String, true),
        col("segment", "Segment", GridColumnType::String, true),
        col("revenue", "Revenue", GridColumnType::Number, true),
        col("seats", "Seats", GridColumnType::Number, true),
        col("health", "Health", GridColumnType::String, true),
        col("enabled", "Enabled", GridColumnType::Boolean, true),
        col("renewal", "Renewal", GridColumnType::Date, true),
        col("last_touch", "Last Touch", GridColumnType::Date, true),
        col("plan", "Plan", GridColumnType::String, true),
        col("tier", "Tier", GridColumnType::String, false),
    ]
}

pub fn tree_columns() -> Vec<GridColumnDef> {
    vec![
        col("account_id", "Account", GridColumnType::String, false),
        col("owner", "Owner", GridColumnType::String, true),
        col("status", "Status", GridColumnType::String, false),
        col("manager", "Manager", GridColumnType::String, true),
        col("region", "Region", GridColumnType::String, true),
        col("revenue", "Revenue", GridColumnType::Number, true),
        col("health", "Health", GridColumnType::String, true),
    ]
}

pub fn columns_for_dataset(dataset: crate::data::Dataset) -> Vec<GridColumnDef> {
    match dataset {
        crate::data::Dataset::Tree => tree_columns(),
        _ => flat_columns(),
    }
}
