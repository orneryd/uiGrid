use crate::{
    display::format_grid_cell_display_value,
    models::{GridColumnDef, GridRow},
    utils::{titleize, to_csv_value},
};

pub fn header_label(column: &GridColumnDef) -> String {
    column.display_name.clone().unwrap_or_else(|| titleize(&column.name))
}

pub fn export_csv_rows(columns: &[GridColumnDef], rows: &[GridRow]) -> String {
    let header = columns
        .iter()
        .map(|column| to_csv_value(&header_label(column)))
        .collect::<Vec<_>>()
        .join(",");

    let body = rows
        .iter()
        .map(|row| {
            columns
                .iter()
                .map(|column| to_csv_value(&format_grid_cell_display_value(row, column)))
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect::<Vec<_>>();

    std::iter::once(header).chain(body).collect::<Vec<_>>().join("\n")
}