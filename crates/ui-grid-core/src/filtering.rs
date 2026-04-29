use std::collections::BTreeMap;

use crate::{
    models::{GridColumnDef, GridOptions, GridRow},
    row_searcher::{run_column_filter, setup_filters},
};

pub fn clear_grid_filter_reasons(row: &mut GridRow) {
    let reasons = row.invisible_reasons.clone();
    for reason in reasons {
        if reason.starts_with("filter:") {
            row.clear_this_row_invisible(&reason);
        }
    }
}

pub fn matches_grid_row_filters(
    row: &mut GridRow,
    columns: &[GridColumnDef],
    options: &GridOptions,
    active_filters: &BTreeMap<String, String>,
) -> bool {
    if !options.enable_filtering {
        return row.visible;
    }

    for column in columns {
        let term = active_filters
            .get(&column.name)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        if term.is_none() || !column.filterable || !column.enable_filtering {
            row.clear_this_row_invisible(&format!("filter:{}", column.name));
            continue;
        }

        let filters = setup_filters(&[crate::models::GridFilterDescriptor {
            term: Some(serde_json::Value::String(term.unwrap())),
            ..column.filter.clone().unwrap_or_default()
        }]);

        let matches_all = filters
            .iter()
            .all(|filter| run_column_filter(&row.entity, column, filter));

        if !matches_all {
            row.set_this_row_invisible(format!("filter:{}", column.name));
            return false;
        }

        row.clear_this_row_invisible(&format!("filter:{}", column.name));
    }

    row.visible
}