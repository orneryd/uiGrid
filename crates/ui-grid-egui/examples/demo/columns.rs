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
        enable_cell_edit: editable,
        ..GridColumnDef::default()
    }
}

pub fn flat_columns() -> Vec<GridColumnDef> {
    vec![
        col("owner", "Owner", GridColumnType::String, true),
        col("status", "Status", GridColumnType::String, true),
        col("revenue", "Revenue", GridColumnType::Number, true),
        col("enabled", "Enabled", GridColumnType::Boolean, true),
        col("renewal", "Renewal", GridColumnType::Date, true),
        col("tier", "Tier", GridColumnType::String, false),
    ]
}

pub fn tree_columns() -> Vec<GridColumnDef> {
    vec![
        col("owner", "Owner", GridColumnType::String, true),
        col("status", "Status", GridColumnType::String, false),
        col("revenue", "Revenue", GridColumnType::Number, true),
    ]
}

pub fn columns_for_dataset(dataset: crate::data::Dataset) -> Vec<GridColumnDef> {
    match dataset {
        crate::data::Dataset::Tree => tree_columns(),
        _ => flat_columns(),
    }
}
