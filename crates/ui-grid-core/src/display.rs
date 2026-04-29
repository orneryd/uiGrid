use crate::{
    models::{GridColumnDef, GridRow},
    utils::{get_cell_value, stringify_cell_value},
};

pub fn format_grid_cell_display_value(row: &GridRow, column: &GridColumnDef) -> String {
    stringify_cell_value(&get_cell_value(&row.entity, column))
}