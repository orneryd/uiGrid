use crate::{
    display::format_grid_cell_display_value,
    models::{GridColumnDef, GridRow},
    state::sanitize_download_filename,
    utils::{titleize, to_csv_value},
};

pub const GRID_CSV_MIME_TYPE: &str = "text/csv;charset=utf-8";

#[derive(Debug, Clone, PartialEq)]
pub struct GridExportContext<'a> {
    pub grid_id: &'a str,
    pub columns: &'a [GridColumnDef],
    pub rows: &'a [GridRow],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GridExportPayload {
    pub filename: String,
    pub mime_type: String,
    pub contents: String,
}

pub fn header_label(column: &GridColumnDef) -> String {
    column
        .display_name
        .clone()
        .unwrap_or_else(|| titleize(&column.name))
}

pub fn build_grid_export_context<'a>(
    grid_id: &'a str,
    columns: &'a [GridColumnDef],
    rows: &'a [GridRow],
) -> GridExportContext<'a> {
    GridExportContext {
        grid_id,
        columns,
        rows,
    }
}

pub fn build_grid_export_payload(
    filename: impl Into<String>,
    mime_type: impl Into<String>,
    contents: impl Into<String>,
) -> GridExportPayload {
    GridExportPayload {
        filename: filename.into(),
        mime_type: mime_type.into(),
        contents: contents.into(),
    }
}

pub fn default_csv_export_filename(grid_id: &str) -> String {
    format!("{}.csv", sanitize_download_filename(grid_id))
}

pub fn export_csv_rows_with<F>(
    columns: &[GridColumnDef],
    rows: &[GridRow],
    format_cell: F,
) -> String
where
    F: Fn(&GridRow, &GridColumnDef) -> String,
{
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
                .map(|column| to_csv_value(&format_cell(row, column)))
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect::<Vec<_>>();

    std::iter::once(header)
        .chain(body)
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn export_csv_rows(columns: &[GridColumnDef], rows: &[GridRow]) -> String {
    export_csv_rows_with(columns, rows, |row, column| {
        format_grid_cell_display_value(row, column)
    })
}

pub fn build_csv_export_payload(context: &GridExportContext<'_>) -> GridExportPayload {
    build_grid_export_payload(
        default_csv_export_filename(context.grid_id),
        GRID_CSV_MIME_TYPE,
        export_csv_rows(context.columns, context.rows),
    )
}

pub fn build_csv_export_payload_with<F>(
    context: &GridExportContext<'_>,
    format_cell: F,
) -> GridExportPayload
where
    F: Fn(&GridRow, &GridColumnDef) -> String,
{
    build_grid_export_payload(
        default_csv_export_filename(context.grid_id),
        GRID_CSV_MIME_TYPE,
        export_csv_rows_with(context.columns, context.rows, format_cell),
    )
}
