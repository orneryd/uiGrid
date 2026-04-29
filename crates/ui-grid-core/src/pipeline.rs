use crate::{
    filtering::matches_grid_row_filters,
    grouping::build_grid_display_items,
    models::{BuildGridPipelineContext, PipelineResult},
    pagination::{is_virtualization_enabled, paginate_grid_rows},
    sorting::sort_grid_rows,
    tree::{build_grid_rows, filter_and_flatten_grid_tree_rows, is_tree_enabled},
};

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
    let rows = build_grid_rows(
        &context.options,
        context.row_size,
        &context.hidden_row_reasons,
        &context.expanded_rows,
    );

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
        let filtered = rows
            .into_iter()
            .filter_map(|row| {
                let mut current = row.clone();
                matches_grid_row_filters(
                    &mut current,
                    &context.columns,
                    &context.options,
                    &context.active_filters,
                )
                .then_some(current)
            })
            .collect::<Vec<_>>();

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
