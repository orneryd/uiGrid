use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::models::GridOptions;

type GridLabelOverrides = Map<String, Value>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridMenuItem {
    pub title: String,
    pub order: usize,
    pub shown: bool,
    pub action_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridExporterMenuContext {
    pub has_selection: bool,
    pub include_pdf: bool,
    pub include_excel: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridRowEditMenuPredicates {
    pub has_dirty_rows: bool,
    pub has_error_rows: bool,
}

fn label(labels: &GridLabelOverrides, key: &str) -> String {
    labels
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

pub fn build_grid_exporter_menu_items(
    options: &GridOptions,
    labels: &GridLabelOverrides,
    context: &GridExporterMenuContext,
) -> Vec<GridMenuItem> {
    let base_order = options.exporter_menu_item_order.unwrap_or(200);
    let menu_csv = options.exporter_menu_csv.unwrap_or(true);
    let menu_pdf = options.exporter_menu_pdf.unwrap_or(true);
    let menu_excel = options.exporter_menu_excel.unwrap_or(true);
    let menu_all_data = options.exporter_menu_all_data.unwrap_or(true);
    let menu_visible = options.exporter_menu_visible_data.unwrap_or(true);
    let menu_selected = options.exporter_menu_selected_data.unwrap_or(true);

    let mut items = vec![
        GridMenuItem {
            title: label(labels, "exporterAllAsCsv"),
            order: base_order,
            shown: menu_csv && menu_all_data,
            action_id: "csv:all:all".to_string(),
        },
        GridMenuItem {
            title: label(labels, "exporterVisibleAsCsv"),
            order: base_order + 1,
            shown: menu_csv && menu_visible,
            action_id: "csv:visible:visible".to_string(),
        },
        GridMenuItem {
            title: label(labels, "exporterSelectedAsCsv"),
            order: base_order + 2,
            shown: menu_csv && menu_selected && context.has_selection,
            action_id: "csv:selected:visible".to_string(),
        },
    ];

    if context.include_pdf {
        items.extend([
            GridMenuItem {
                title: label(labels, "exporterAllAsPdf"),
                order: base_order + 3,
                shown: menu_pdf && menu_all_data,
                action_id: "pdf:all:all".to_string(),
            },
            GridMenuItem {
                title: label(labels, "exporterVisibleAsPdf"),
                order: base_order + 4,
                shown: menu_pdf && menu_visible,
                action_id: "pdf:visible:visible".to_string(),
            },
            GridMenuItem {
                title: label(labels, "exporterSelectedAsPdf"),
                order: base_order + 5,
                shown: menu_pdf && menu_selected && context.has_selection,
                action_id: "pdf:selected:visible".to_string(),
            },
        ]);
    }

    if context.include_excel {
        items.extend([
            GridMenuItem {
                title: label(labels, "exporterAllAsExcel"),
                order: base_order + 6,
                shown: menu_excel && menu_all_data,
                action_id: "excel:all:all".to_string(),
            },
            GridMenuItem {
                title: label(labels, "exporterVisibleAsExcel"),
                order: base_order + 7,
                shown: menu_excel && menu_visible,
                action_id: "excel:visible:visible".to_string(),
            },
            GridMenuItem {
                title: label(labels, "exporterSelectedAsExcel"),
                order: base_order + 8,
                shown: menu_excel && menu_selected && context.has_selection,
                action_id: "excel:selected:visible".to_string(),
            },
        ]);
    }

    items
}

pub fn build_grid_importer_menu_items(
    options: &GridOptions,
    labels: &GridLabelOverrides,
) -> Vec<GridMenuItem> {
    if options.enable_importer != Some(true) {
        return Vec::new();
    }
    if options.importer_show_menu == Some(false) {
        return Vec::new();
    }
    vec![GridMenuItem {
        title: label(labels, "importerTitle"),
        order: options.importer_menu_item_order.unwrap_or(400),
        shown: true,
        action_id: "import:file".to_string(),
    }]
}

pub fn build_grid_row_edit_menu_items(
    options: &GridOptions,
    labels: &GridLabelOverrides,
    predicates: &GridRowEditMenuPredicates,
) -> Vec<GridMenuItem> {
    let base_order = options.row_edit_menu_item_order.unwrap_or(300);
    let menu_flush = options.row_edit_menu_flush_dirty_rows.unwrap_or(true);
    let menu_cancel = options.row_edit_menu_cancel_dirty_rows.unwrap_or(true);

    let mut items = Vec::new();
    if menu_flush {
        items.push(GridMenuItem {
            title: label(labels, "rowEditFlushAll"),
            order: base_order,
            shown: predicates.has_dirty_rows,
            action_id: "row-edit:flush-dirty".to_string(),
        });
    }
    if menu_cancel {
        items.push(GridMenuItem {
            title: label(labels, "rowEditRetryErrors"),
            order: base_order + 1,
            shown: predicates.has_error_rows,
            action_id: "row-edit:retry-errors".to_string(),
        });
    }
    items
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn exporter_menu_respects_selection_and_optional_formats() {
        let items = build_grid_exporter_menu_items(
            &GridOptions::default(),
            &serde_json::from_value(json!({ "exporterAllAsCsv": "csv" })).unwrap(),
            &GridExporterMenuContext {
                has_selection: false,
                include_pdf: false,
                include_excel: false,
            },
        );
        assert_eq!(items.len(), 3);
        assert!(!items[2].shown);
    }

    #[test]
    fn importer_menu_is_empty_when_disabled() {
        assert!(build_grid_importer_menu_items(&GridOptions::default(), &Map::new()).is_empty());
    }
}
