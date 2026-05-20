//! Host-agnostic pipeline benchmark probe. Mirrors the TS
//! `gridApi.core.benchmark(iterations) -> Promise<GridBenchmarkResult>`
//! API: runs `build_grid_pipeline` N times against the same context
//! and reports total / average wall time plus the number of visible
//! rows / display items it produced.
//!
//! The TS surface is async because the JS pipeline yields between
//! iterations to avoid starving the UI thread. Rust can run the loop
//! synchronously since the engine is pure CPU; hosts that want to
//! interleave with their event loop can call `step` themselves and
//! aggregate the results.

use serde::{Deserialize, Serialize};

use crate::{models::BuildGridPipelineContext, pipeline::build_grid_pipeline};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridBenchmarkResult {
    pub iterations: usize,
    pub total_ms: f64,
    pub average_ms: f64,
    pub visible_rows: usize,
    pub rendered_items: usize,
}

/// Run the pipeline `iterations` times against `context` and report
/// timings. The default iteration count is 25 (mirrors the TS
/// `benchmark.iterations ?? 25` fallback). Returns `None` when
/// `iterations` is zero so callers don't have to special-case the
/// divide-by-zero in `average_ms`.
pub fn run_grid_benchmark(
    context: &BuildGridPipelineContext,
    iterations: usize,
) -> Option<GridBenchmarkResult> {
    if iterations == 0 {
        return None;
    }

    // Drop any stale rows-cache entry up front. The cache keys on
    // raw-pointer identity which is only sound when the same context
    // reference is reused across calls; a fresh benchmark invocation
    // builds a new context on the stack, so a residual cache entry
    // from a prior call could either falsely hit (stale data) or
    // never hit because the address differs.
    crate::pipeline::clear_grid_pipeline_rows_cache();

    let mut total_ms = 0.0_f64;
    let mut last_visible = 0usize;
    let mut last_rendered = 0usize;
    for _ in 0..iterations {
        let started = pipeline_started_at();
        let result = build_grid_pipeline(context);
        total_ms += pipeline_elapsed_ms(started);
        last_visible = result.visible_rows.len();
        last_rendered = result.display_items.len();
    }

    Some(GridBenchmarkResult {
        iterations,
        total_ms,
        average_ms: total_ms / iterations as f64,
        visible_rows: last_visible,
        rendered_items: last_rendered,
    })
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
    // Wasm: we deliberately don't pull in `web_sys::performance` here
    // because the bridge already wraps the call and reports timings
    // via its own clock. The bench probe still produces a valid
    // result; only `total_ms` / `average_ms` will be zero.
    0.0
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use crate::{
        constants::SortDirection,
        models::{BuildGridPipelineContext, GridColumnDef, GridOptions, SortState},
    };

    use super::*;

    fn make_context() -> BuildGridPipelineContext {
        BuildGridPipelineContext {
            options: GridOptions {
                id: "bench".to_string(),
                ..GridOptions::default()
            },
            columns: vec![GridColumnDef {
                name: "name".to_string(),
                ..GridColumnDef::default()
            }],
            active_filters: BTreeMap::new(),
            sort_state: SortState {
                column_name: None,
                direction: SortDirection::None,
            },
            group_by_columns: Vec::new(),
            collapsed_groups: BTreeMap::new(),
            hidden_row_reasons: BTreeMap::new(),
            expanded_rows: BTreeMap::new(),
            expanded_tree_rows: BTreeMap::new(),
            current_page: 1,
            page_size: 0,
            row_size: 44,
        }
    }

    #[test]
    fn returns_none_when_iterations_is_zero() {
        let ctx = make_context();
        assert!(run_grid_benchmark(&ctx, 0).is_none());
    }

    #[test]
    fn reports_iterations_and_visible_rows() {
        let ctx = make_context();
        let result = run_grid_benchmark(&ctx, 3).unwrap();
        assert_eq!(result.iterations, 3);
        // Empty data -> zero visible rows.
        assert_eq!(result.visible_rows, 0);
        // total_ms / average_ms can be 0.0 on extremely fast hosts;
        // we just assert the average_ms == total_ms / iterations.
        assert!((result.average_ms - result.total_ms / 3.0).abs() < f64::EPSILON);
    }
}
