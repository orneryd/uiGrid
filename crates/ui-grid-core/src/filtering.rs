use std::collections::BTreeMap;

use crate::{
    models::{GridColumnDef, GridOptions, GridRow},
    row_searcher::{ParsedFilter, run_column_filter, setup_filters},
};

pub fn clear_grid_filter_reasons(row: &mut GridRow) {
    let reasons = row.invisible_reasons.clone();
    for reason in reasons {
        if reason.starts_with("filter:") {
            row.clear_this_row_invisible(&reason);
        }
    }
}

/// Prepared filter spec for a single column — the parsed regex / term is
/// computed once in [`prepare_grid_column_filters`] and reused across every
/// row in the pipeline. Mirrors the TS `PreparedColumnFilter` type.
#[derive(Debug, Clone)]
pub struct PreparedColumnFilter<'a> {
    pub column: &'a GridColumnDef,
    pub reason_key: String,
    pub filters: Vec<ParsedFilter>,
}

/// Pre-compute filters once per column; reused across every row in the
/// pipeline. Columns with empty terms or `filterable: false` are skipped.
/// Caller must keep `columns` alive for the duration of the prepared
/// vector's use — mirrors TS's `prepareGridColumnFilters`.
pub fn prepare_grid_column_filters<'a>(
    columns: &'a [GridColumnDef],
    active_filters: &BTreeMap<String, String>,
) -> Vec<PreparedColumnFilter<'a>> {
    let mut prepared = Vec::new();
    for column in columns {
        if !column.filterable || !column.enable_filtering {
            continue;
        }
        let Some(term) = active_filters
            .get(&column.name)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };

        let filters = setup_filters(&[crate::models::GridFilterDescriptor {
            term: Some(serde_json::Value::String(term)),
            ..column.filter.clone().unwrap_or_default()
        }]);
        if filters.is_empty() {
            continue;
        }

        prepared.push(PreparedColumnFilter {
            column,
            reason_key: format!("filter:{}", column.name),
            filters,
        });
    }
    prepared
}

/// Fast-path filter matcher for the pipeline. Pre-prepared filter specs
/// are passed in, so this function does no regex compilation per row.
/// When the caller already knows `prepared.is_empty()`, it can bypass
/// this entirely and just return `row.visible`.
pub fn matches_grid_row_prepared_filters(
    row: &mut GridRow,
    prepared: &[PreparedColumnFilter<'_>],
) -> bool {
    for entry in prepared {
        let matches_all = entry
            .filters
            .iter()
            .all(|filter| run_column_filter(&row.entity, entry.column, filter));
        if !matches_all {
            row.set_this_row_invisible(entry.reason_key.clone());
            return false;
        }
        // Only touch the Set when an earlier pass left a stale reason behind.
        if row.invisible_reasons.contains(&entry.reason_key) {
            row.clear_this_row_invisible(&entry.reason_key);
        }
    }
    row.visible
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

    let prepared = prepare_grid_column_filters(columns, active_filters);

    // Clear stale `filter:<column>` reasons for columns that no longer
    // have an active filter — `prepare_grid_column_filters` skips inactive
    // columns entirely, so the prepared loop won't visit them.
    if !row.invisible_reasons.is_empty() {
        for column in columns {
            let key = format!("filter:{}", column.name);
            let active = active_filters
                .get(&column.name)
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .is_some();
            if !active && row.invisible_reasons.contains(&key) {
                row.clear_this_row_invisible(&key);
            }
        }
    }

    matches_grid_row_prepared_filters(row, &prepared)
}
