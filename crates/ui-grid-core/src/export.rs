use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    display::format_grid_cell_display_value,
    models::{GridColumnDef, GridOptions, GridRow},
    state::sanitize_download_filename,
    utils::{get_cell_value, titleize, to_csv_value},
};

pub const GRID_CSV_MIME_TYPE: &str = "text/csv;charset=utf-8";
pub const GRID_EXPORTER_SELECTION_ROW_HEADER_COL_NAME: &str = "selectionRowHeaderCol";
pub const GRID_EXPORTER_ROW_HEADER_COL_NAME: &str = "treeBaseRowHeaderCol";
const UTF8_BOM: &str = "\u{feff}";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GridExporterColumnType {
    All,
    Visible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GridExporterRowType {
    All,
    Visible,
    Selected,
}

/// Resolve the output filename. Mirrors the TS helper of the same name —
/// callers that have a static filename string get it back; callers with
/// nothing get the supplied fallback. JS callers that source the filename
/// from a callback are expected to evaluate the callback host-side
/// before invoking this helper, since closures don't cross the wasm
/// boundary. The `row_type` / `col_type` arguments are accepted so the
/// signature shape matches the canonical TS call site.
pub fn resolve_exporter_filename(
    filename: Option<&str>,
    fallback: &str,
    _row_type: GridExporterRowType,
    _col_type: GridExporterColumnType,
) -> String {
    match filename {
        Some(value) if !value.is_empty() => value.to_string(),
        _ => fallback.to_string(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub csv_column_separator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub csv_filename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header_filter_use_name: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_header: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suppress_columns: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub older_excel_compatibility: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_excel_compatible: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suppress_menu: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub menu_label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterPdfOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_grid_width: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_style: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_style: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_header_style: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub footer: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterExcelOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sheet_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_scale_factor: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GridExporterPdfCell {
    Text(String),
    Aligned { text: String, alignment: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterPdfTable {
    pub header_rows: usize,
    pub widths: Vec<Value>,
    pub body: Vec<Vec<Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterPdfContent {
    pub style: String,
    pub table: GridExporterPdfTable,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterPdfDocDefinition {
    pub page_orientation: String,
    pub page_size: String,
    pub content: Vec<GridExporterPdfContent>,
    pub styles: Value,
    pub default_style: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub footer: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterExcelCell {
    pub value: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

pub type GridExporterExcelSheetData = Vec<Vec<GridExporterExcelCell>>;

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

/// Mirrors TS `GridHeaderTemplateContext`: the column plus its resolved
/// display label, packaged for `headerRenderer` callbacks. The serialized
/// shape is `{ $implicit, value, column }` — the `$implicit` key matches
/// Angular template-context conventions and is what consumer code in the
/// vanilla / Angular / React adapters reads.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GridHeaderTemplateContext {
    #[serde(rename = "$implicit")]
    pub implicit: String,
    pub value: String,
    pub column: GridColumnDef,
}

/// Build a header-template context for `column`. Pairs with
/// [`format_grid_header_display_value`] which honours an optional
/// JS-side `headerRenderer` callback (handled host-side via the wasm
/// bridge — Rust returns the `value` string verbatim).
pub fn build_grid_header_context(column: &GridColumnDef) -> GridHeaderTemplateContext {
    let value = header_label(column);
    GridHeaderTemplateContext {
        implicit: value.clone(),
        value,
        column: column.clone(),
    }
}

/// Resolve the header display string for `context`. The TS counterpart
/// can invoke a JS `column.headerRenderer` callback; closures don't
/// cross the wasm boundary, so the Rust port returns the resolved label
/// directly. The wasm bridge wrapper checks for a function-typed
/// `headerRenderer` host-side and runs it before falling back here.
pub fn format_grid_header_display_value(context: &GridHeaderTemplateContext) -> String {
    context.value.clone()
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

fn resolve_header(column: &GridColumnDef, options: &GridExporterOptions) -> String {
    if options.header_filter_use_name == Some(true) {
        column.name.clone()
    } else {
        column
            .display_name
            .clone()
            .unwrap_or_else(|| titleize(&column.name))
    }
}

pub fn filter_exporter_columns(
    columns: &[GridColumnDef],
    options: &GridExporterOptions,
    col_type: GridExporterColumnType,
) -> Vec<GridColumnDef> {
    let suppressed = options.suppress_columns.clone().unwrap_or_default();
    columns
        .iter()
        .filter(|column| {
            !matches!(
                column.name.as_str(),
                GRID_EXPORTER_SELECTION_ROW_HEADER_COL_NAME | GRID_EXPORTER_ROW_HEADER_COL_NAME
            )
        })
        .filter(|column| !suppressed.contains(&column.name))
        .filter(|column| !column.exporter_suppress_export)
        .filter(|column| match col_type {
            GridExporterColumnType::All => true,
            GridExporterColumnType::Visible => column.visible,
        })
        .cloned()
        .collect()
}

fn to_csv_value_with_separator(value: &str, separator: &str) -> String {
    if separator == "," {
        return to_csv_value(value);
    }

    let mut escaped = value.to_string();
    if matches!(
        escaped.chars().next(),
        Some('=' | '+' | '-' | '@' | '\t' | '\r')
    ) {
        escaped = format!("'{}", escaped);
    }
    if escaped.contains(separator) || escaped.contains('"') || escaped.contains('\n') {
        return format!("\"{}\"", escaped.replace('"', "\"\""));
    }
    escaped
}

pub fn build_grid_csv(
    columns: &[GridColumnDef],
    rows: &[GridRow],
    options: &GridExporterOptions,
    col_type: GridExporterColumnType,
) -> String {
    let separator = options.csv_column_separator.as_deref().unwrap_or(",");
    let effective_columns = filter_exporter_columns(columns, options, col_type);
    let exportable_rows = rows
        .iter()
        .filter(|row| row.exporter_enable_exporting)
        .collect::<Vec<_>>();
    let show_header = options.show_header != Some(false);
    let header_cells = effective_columns
        .iter()
        .map(|column| to_csv_value_with_separator(&resolve_header(column, options), separator))
        .collect::<Vec<_>>()
        .join(separator);
    let header = options
        .header_template
        .as_ref()
        .map(|template| template.replace("HEADER_VALUES", &header_cells))
        .unwrap_or(header_cells);
    let body = exportable_rows
        .iter()
        .map(|row| {
            effective_columns
                .iter()
                .map(|column| {
                    to_csv_value_with_separator(
                        &format_grid_cell_display_value(row, column),
                        separator,
                    )
                })
                .collect::<Vec<_>>()
                .join(separator)
        })
        .collect::<Vec<_>>();
    let mut csv = if show_header {
        std::iter::once(header)
            .chain(body)
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        body.join("\n")
    };
    if options.older_excel_compatibility == Some(true) {
        csv = format!("{UTF8_BOM}{csv}");
    }
    csv
}

pub fn resolve_grid_exporter_options(options: &GridOptions) -> GridExporterOptions {
    GridExporterOptions {
        csv_column_separator: options.exporter_csv_column_separator.clone(),
        csv_filename: options.exporter_csv_filename.clone(),
        header_filter_use_name: options.exporter_header_filter_use_name,
        header_template: options.exporter_header_template.clone(),
        show_header: options.exporter_show_header,
        suppress_columns: options.exporter_suppress_columns.clone(),
        older_excel_compatibility: options.exporter_older_excel_compatibility,
        is_excel_compatible: options.exporter_is_excel_compatible,
        suppress_menu: options.exporter_suppress_menu,
        menu_label: options.exporter_menu_label.clone(),
    }
}

pub fn resolve_grid_exporter_pdf_options(options: &GridOptions) -> GridExporterPdfOptions {
    GridExporterPdfOptions {
        filename: options.exporter_pdf_filename.clone(),
        orientation: options.exporter_pdf_orientation.clone(),
        page_size: options.exporter_pdf_page_size.clone(),
        max_grid_width: options.exporter_pdf_max_grid_width,
        default_style: options.exporter_pdf_default_style.clone(),
        table_style: options.exporter_pdf_table_style.clone(),
        table_header_style: options.exporter_pdf_table_header_style.clone(),
        layout: options.exporter_pdf_layout.clone(),
        header: options.exporter_pdf_header.clone(),
        footer: options.exporter_pdf_footer.clone(),
    }
}

pub fn resolve_grid_exporter_excel_options(options: &GridOptions) -> GridExporterExcelOptions {
    GridExporterExcelOptions {
        filename: options.exporter_excel_filename.clone(),
        sheet_name: options.exporter_excel_sheet_name.clone(),
        header: options.exporter_excel_header.clone(),
        column_scale_factor: options.exporter_column_scale_factor,
    }
}

pub fn format_grid_pdf_field(value: &Value, alignment: Option<&str>) -> Value {
    let text = match value {
        Value::Null => String::new(),
        Value::Bool(value) => {
            if *value {
                "TRUE".to_string()
            } else {
                "FALSE".to_string()
            }
        }
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.replace('"', "\"\""),
        other => serde_json::to_string(other)
            .unwrap_or_default()
            .trim_matches('"')
            .to_string(),
    };
    match alignment {
        Some(alignment) => serde_json::json!({ "text": text, "alignment": alignment }),
        None => Value::String(text),
    }
}

fn parse_pdf_column_width(width: Option<&String>) -> Value {
    match width {
        None => Value::String("*".to_string()),
        Some(width) if width == "*" => Value::String("*".to_string()),
        Some(width) if width.ends_with('%') => Value::String(width.clone()),
        Some(width) => width
            .parse::<usize>()
            .map(|value| serde_json::json!(value))
            .unwrap_or_else(|_| Value::String(width.clone())),
    }
}

pub fn calculate_grid_pdf_column_widths(
    columns: &[GridColumnDef],
    max_grid_width: usize,
) -> Vec<Value> {
    let widths = columns
        .iter()
        .map(|column| parse_pdf_column_width(column.width.as_ref()))
        .collect::<Vec<_>>();
    let base_grid_width = widths.iter().filter_map(Value::as_f64).sum::<f64>();
    let resolved = widths
        .into_iter()
        .map(|value| {
            if value == Value::String("*".to_string()) {
                return value;
            }
            if let Some(percent) = value.as_str().and_then(|raw| raw.strip_suffix('%'))
                && let Ok(percent) = percent.parse::<f64>()
            {
                return serde_json::json!((base_grid_width * percent) / 100.0);
            }
            value
        })
        .collect::<Vec<_>>();
    let grid_width = resolved.iter().filter_map(Value::as_f64).sum::<f64>();
    if grid_width == 0.0 {
        return resolved
            .into_iter()
            .map(|value| {
                if value == Value::String("*".to_string()) {
                    value
                } else {
                    serde_json::json!(1)
                }
            })
            .collect();
    }
    resolved
        .into_iter()
        .map(|value| {
            if value == Value::String("*".to_string()) {
                value
            } else {
                serde_json::json!(
                    (value.as_f64().unwrap_or(0.0) * max_grid_width as f64) / grid_width
                )
            }
        })
        .collect()
}

pub fn build_grid_pdf_doc_definition(
    columns: &[GridColumnDef],
    rows: &[GridRow],
    pdf_options: &GridExporterPdfOptions,
    exporter_options: &GridExporterOptions,
    col_type: GridExporterColumnType,
) -> GridExporterPdfDocDefinition {
    let effective_columns = filter_exporter_columns(columns, exporter_options, col_type);
    let widths = calculate_grid_pdf_column_widths(
        &effective_columns,
        pdf_options.max_grid_width.unwrap_or(720),
    );
    let header_row = effective_columns
        .iter()
        .map(|column| serde_json::json!({ "text": resolve_header(column, exporter_options), "style": "tableHeader" }))
        .collect::<Vec<_>>();
    let body_rows = rows
        .iter()
        .filter(|row| row.exporter_enable_exporting)
        .map(|row| {
            effective_columns
                .iter()
                .map(|column| {
                    format_grid_pdf_field(
                        &Value::String(format_grid_cell_display_value(row, column)),
                        column.exporter_pdf_align.as_deref(),
                    )
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    GridExporterPdfDocDefinition {
        page_orientation: pdf_options
            .orientation
            .clone()
            .unwrap_or_else(|| "landscape".to_string()),
        page_size: pdf_options
            .page_size
            .clone()
            .unwrap_or_else(|| "A4".to_string()),
        content: vec![GridExporterPdfContent {
            style: "tableStyle".to_string(),
            table: GridExporterPdfTable {
                header_rows: 1,
                widths,
                body: std::iter::once(header_row).chain(body_rows).collect(),
            },
        }],
        styles: serde_json::json!({
            "tableStyle": pdf_options.table_style.clone().unwrap_or_else(|| serde_json::json!({ "margin": [0, 5, 0, 15] })),
            "tableHeader": pdf_options.table_header_style.clone().unwrap_or_else(|| serde_json::json!({ "bold": true, "fontSize": 12, "color": "black" }))
        }),
        default_style: pdf_options
            .default_style
            .clone()
            .unwrap_or_else(|| serde_json::json!({ "fontSize": 11 })),
        layout: pdf_options.layout.clone(),
        header: pdf_options.header.clone(),
        footer: pdf_options.footer.clone(),
    }
}

pub fn format_grid_excel_field(value: &Value) -> Value {
    match value {
        Value::Null => Value::String(String::new()),
        Value::Bool(value) => Value::String(if *value { "TRUE" } else { "FALSE" }.to_string()),
        Value::Number(_) | Value::String(_) => value.clone(),
        other => Value::String(serde_json::to_string(other).unwrap_or_default()),
    }
}

pub fn build_grid_excel_sheet_data(
    columns: &[GridColumnDef],
    rows: &[GridRow],
    exporter_options: &GridExporterOptions,
    col_type: GridExporterColumnType,
    styles: Option<&Value>,
) -> GridExporterExcelSheetData {
    let effective_columns = filter_exporter_columns(columns, exporter_options, col_type);
    let show_header = exporter_options.show_header != Some(false);
    let mut sheet = Vec::new();
    if show_header {
        let style_map = styles.and_then(Value::as_object);
        let header_row = effective_columns
            .iter()
            .map(|column| GridExporterExcelCell {
                value: Value::String(resolve_header(column, exporter_options)),
                metadata: style_map
                    .and_then(|map| map.get("header"))
                    .and_then(|value| value.get("id"))
                    .map(|style| serde_json::json!({ "style": style })),
            })
            .collect::<Vec<_>>();
        sheet.push(header_row);
    }
    for row in rows.iter().filter(|row| row.exporter_enable_exporting) {
        sheet.push(
            effective_columns
                .iter()
                .map(|column| GridExporterExcelCell {
                    value: format_grid_excel_field(&get_cell_value(&row.entity, column)),
                    metadata: None,
                })
                .collect(),
        );
    }
    sheet
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::models::GridRecord;

    fn row(id: &str, entity: GridRecord, index: usize) -> GridRow {
        GridRow::new(id.to_string(), entity, index, 44)
    }

    #[test]
    fn csv_and_filtering_match_default_export_behavior() {
        let columns = vec![
            GridColumnDef {
                name: "name".to_string(),
                display_name: Some("Name".to_string()),
                ..GridColumnDef::default()
            },
            GridColumnDef {
                name: "status".to_string(),
                display_name: Some("Status".to_string()),
                visible: false,
                ..GridColumnDef::default()
            },
            GridColumnDef {
                name: "revenue".to_string(),
                display_name: Some("Revenue".to_string()),
                ..GridColumnDef::default()
            },
        ];
        let rows = vec![
            row(
                "r1",
                json!({ "name": "Alpha", "status": "Active", "revenue": 100 }),
                0,
            ),
            row(
                "r2",
                json!({ "name": "Beta, Inc.", "status": "Pilot", "revenue": 200 }),
                1,
            ),
        ];
        assert_eq!(
            build_grid_csv(
                &columns,
                &rows,
                &GridExporterOptions::default(),
                GridExporterColumnType::Visible
            ),
            "Name,Revenue\nAlpha,100\n\"Beta, Inc.\",200"
        );
    }

    #[test]
    fn pdf_and_excel_builders_return_serializable_descriptors() {
        let columns = vec![GridColumnDef {
            name: "name".to_string(),
            display_name: Some("Name".to_string()),
            ..GridColumnDef::default()
        }];
        let rows = vec![row("r1", json!({ "name": "Alpha" }), 0)];
        let doc = build_grid_pdf_doc_definition(
            &columns,
            &rows,
            &GridExporterPdfOptions::default(),
            &GridExporterOptions::default(),
            GridExporterColumnType::Visible,
        );
        assert_eq!(doc.page_orientation, "landscape");
        assert_eq!(
            doc.content[0].table.body[1],
            vec![Value::String("Alpha".to_string())]
        );

        let sheet = build_grid_excel_sheet_data(
            &columns,
            &rows,
            &GridExporterOptions::default(),
            GridExporterColumnType::Visible,
            None,
        );
        assert_eq!(sheet[0][0].value, Value::String("Name".to_string()));
        assert_eq!(sheet[1][0].value, Value::String("Alpha".to_string()));
    }
}
