use std::cell::RefCell;

use crate::{
    filtering::{matches_grid_row_prepared_filters, prepare_grid_column_filters},
    grouping::build_grid_display_items,
    models::{BuildGridPipelineContext, GridRow, PipelineResult},
    pagination::{is_virtualization_enabled, paginate_grid_rows},
    sorting::sort_grid_rows,
    tree::{build_grid_rows, filter_and_flatten_grid_tree_rows, is_tree_enabled},
};

/// Cache built `Vec<GridRow>` by the tuple of inputs `build_grid_rows`
/// actually reads. Mirrors the TS `rowsCache` in `grid.core.pipeline.ts` —
/// the benchmark loop and unchanged-data refreshes hit this cache and
/// skip the per-row allocation pass. When any input identity changes
/// (new data array, hidden-reasons edit, expansion toggle, row-size
/// change) the cache misses and a fresh set is built.
///
/// In Rust, "reference identity" on owned values is approximated by raw
/// pointer comparison on the borrowed data + length checks (so a freshly
/// realloc'd `Vec` at the same address with a different length still
/// invalidates). The TS implementation compares `===` references, so the
/// equivalent here is "same backing pointer + same length" for the data
/// array and same backing pointer + same length for the hidden / expanded
/// maps.
struct RowsCacheEntry {
    data_ptr: usize,
    data_len: usize,
    options_ptr: usize,
    hidden_ptr: usize,
    hidden_len: usize,
    expanded_ptr: usize,
    expanded_len: usize,
    row_size: usize,
    rows: Vec<GridRow>,
}

thread_local! {
    static ROWS_CACHE: RefCell<Option<RowsCacheEntry>> = const { RefCell::new(None) };
}

fn build_grid_rows_cached(context: &BuildGridPipelineContext) -> Vec<GridRow> {
    let data_ptr = context.options.data.as_ptr() as usize;
    let data_len = context.options.data.len();
    let options_ptr = (&context.options as *const _) as usize;
    let hidden_ptr = (&context.hidden_row_reasons as *const _) as usize;
    let hidden_len = context.hidden_row_reasons.len();
    let expanded_ptr = (&context.expanded_rows as *const _) as usize;
    let expanded_len = context.expanded_rows.len();
    let row_size = context.row_size;

    let cached = ROWS_CACHE.with(|cache| {
        let cache = cache.borrow();
        cache.as_ref().and_then(|entry| {
            if entry.data_ptr == data_ptr
                && entry.data_len == data_len
                && entry.options_ptr == options_ptr
                && entry.hidden_ptr == hidden_ptr
                && entry.hidden_len == hidden_len
                && entry.expanded_ptr == expanded_ptr
                && entry.expanded_len == expanded_len
                && entry.row_size == row_size
            {
                Some(entry.rows.clone())
            } else {
                None
            }
        })
    });
    if let Some(rows) = cached {
        return rows;
    }

    let rows = build_grid_rows(
        &context.options,
        row_size,
        &context.hidden_row_reasons,
        &context.expanded_rows,
    );

    ROWS_CACHE.with(|cache| {
        *cache.borrow_mut() = Some(RowsCacheEntry {
            data_ptr,
            data_len,
            options_ptr,
            hidden_ptr,
            hidden_len,
            expanded_ptr,
            expanded_len,
            row_size,
            rows: rows.clone(),
        });
    });
    rows
}

/// Public wrapper exposing the cache lookup. Returns the cached `Vec<GridRow>`
/// when the input identity matches the previous call; otherwise rebuilds.
/// Mirrors TS `getCachedGridPipelineRows`.
pub fn get_cached_grid_pipeline_rows(context: &BuildGridPipelineContext) -> Vec<GridRow> {
    build_grid_rows_cached(context)
}

/// Drop the rows cache. Callers should invoke this when they know the
/// inputs are about to change in ways the identity comparison can't see
/// (e.g. mutating the data array in place at the same address). Mirrors
/// TS `clearGridPipelineRowsCache`.
pub fn clear_grid_pipeline_rows_cache() {
    ROWS_CACHE.with(|cache| {
        *cache.borrow_mut() = None;
    });
}

/// Strip stale `filter:*` reasons from cached rows between pipeline
/// passes. The TS pipeline calls this before re-evaluating filters since
/// the row instances are reused across calls and would otherwise carry
/// over invisibility state from a previous filter set.
fn reset_filter_reasons(rows: &mut [GridRow]) {
    for row in rows {
        if row.invisible_reasons.is_empty() {
            continue;
        }
        let had_filter = row
            .invisible_reasons
            .iter()
            .any(|reason| reason.starts_with("filter:"));
        if !had_filter {
            continue;
        }
        row.invisible_reasons
            .retain(|reason| !reason.starts_with("filter:"));
        if row.invisible_reasons.is_empty() {
            row.visible = true;
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn pipeline_started_at() -> std::time::Instant {
    std::time::Instant::now()
}

#[cfg(target_arch = "wasm32")]
fn pipeline_started_at() {}

#[cfg(not(target_arch = "wasm32"))]
fn pipeline_elapsed_ms(started_at: std::time::Instant) -> f64 {
    started_at.elapsed().as_secs_f64() * 1000.0
}

#[cfg(target_arch = "wasm32")]
fn pipeline_elapsed_ms(_: ()) -> f64 {
    0.0
}

pub fn build_grid_pipeline(context: &BuildGridPipelineContext) -> PipelineResult {
    let started_at = pipeline_started_at();
    let mut rows = build_grid_rows_cached(context);

    let visible_rows = if is_tree_enabled(&context.options) {
        filter_and_flatten_grid_tree_rows(
            &rows,
            &context.columns,
            &context.options,
            &context.active_filters,
            &context.expanded_tree_rows,
            &context.sort_state,
        )
    } else {
        let filtering_enabled = context.options.enable_filtering;
        // Rows are cached across pipeline passes — clear stale `filter:*`
        // reasons before re-evaluating so persisted invisibility state
        // doesn't leak between filter changes. Mirrors TS pipeline's
        // `resetFilterReasons` call.
        reset_filter_reasons(&mut rows);
        let filtered = if !filtering_enabled {
            rows.into_iter().filter(|row| row.visible).collect()
        } else {
            // Prepare per-column filter specs once; the inner row loop
            // reuses the parsed regexes / terms so it does no regex
            // compilation per row.
            let prepared = prepare_grid_column_filters(&context.columns, &context.active_filters);
            if prepared.is_empty() {
                rows.into_iter().filter(|row| row.visible).collect()
            } else {
                rows.into_iter()
                    .filter_map(|row| {
                        let mut current = row.clone();
                        if !current.visible {
                            return None;
                        }
                        matches_grid_row_prepared_filters(&mut current, &prepared)
                            .then_some(current)
                    })
                    .collect::<Vec<_>>()
            }
        };

        sort_grid_rows(
            &filtered,
            &context.columns,
            &context.options,
            &context.sort_state,
        )
    };

    let total_items = if context.options.use_external_pagination {
        context.options.total_items.unwrap_or(visible_rows.len())
    } else {
        visible_rows.len()
    };

    let paged_rows = paginate_grid_rows(
        &visible_rows,
        &context.options,
        context.current_page,
        context.page_size,
        total_items,
    );

    let display_items = build_grid_display_items(
        &paged_rows,
        &context.columns,
        &context.options,
        &context.group_by_columns,
        &context.collapsed_groups,
    );

    PipelineResult {
        visible_rows: paged_rows,
        virtualization_enabled: is_virtualization_enabled(&context.options, display_items.len()),
        display_items,
        pipeline_ms: pipeline_elapsed_ms(started_at),
        total_items,
    }
}
