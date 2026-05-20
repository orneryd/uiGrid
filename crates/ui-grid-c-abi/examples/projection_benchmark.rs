use std::collections::BTreeMap;
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use ui_grid_c_abi::UiGridProjection;
use ui_grid_contracts::{
    C_ABI_VERSION, COMMAND_SCHEMA_VERSION, ENGINE_CONTRACT_VERSION, PROJECTION_SCHEMA_VERSION,
    UiGridProjectionEnvelope,
};
use ui_grid_core::{
    constants::SortDirection,
    models::{BuildGridPipelineContext, GridColumnDef, GridOptions, SortState},
    pipeline::build_grid_pipeline,
};

fn main() {
    let iterations = 200;
    let envelope = build_representative_projection();
    let saved_state = build_representative_saved_state();

    let (json_size, json_encode, json_decode) = benchmark_json(&envelope, iterations);
    let (message_pack_size, message_pack_encode, message_pack_decode) =
        benchmark_message_pack(&envelope, iterations);
    let (json_state_size, json_state_encode, json_state_decode) =
        benchmark_saved_state_json(&saved_state, iterations);
    let (message_pack_state_size, message_pack_state_encode, message_pack_state_decode) =
        benchmark_saved_state_message_pack(&saved_state, iterations);

    println!("projectionCodecBenchmark:");
    println!(
        "  json size={} encode_avg_us={:.2} decode_avg_us={:.2}",
        json_size,
        duration_per_iteration(json_encode, iterations).as_secs_f64() * 1_000_000.0,
        duration_per_iteration(json_decode, iterations).as_secs_f64() * 1_000_000.0,
    );
    println!(
        "  messagePack size={} encode_avg_us={:.2} decode_avg_us={:.2}",
        message_pack_size,
        duration_per_iteration(message_pack_encode, iterations).as_secs_f64() * 1_000_000.0,
        duration_per_iteration(message_pack_decode, iterations).as_secs_f64() * 1_000_000.0,
    );
    println!(
        "  size_delta_bytes={}",
        json_size as isize - message_pack_size as isize,
    );
    println!("savedStateCodecBenchmark:");
    println!(
        "  json size={} encode_avg_us={:.2} decode_avg_us={:.2}",
        json_state_size,
        duration_per_iteration(json_state_encode, iterations).as_secs_f64() * 1_000_000.0,
        duration_per_iteration(json_state_decode, iterations).as_secs_f64() * 1_000_000.0,
    );
    println!(
        "  messagePack size={} encode_avg_us={:.2} decode_avg_us={:.2}",
        message_pack_state_size,
        duration_per_iteration(message_pack_state_encode, iterations).as_secs_f64() * 1_000_000.0,
        duration_per_iteration(message_pack_state_decode, iterations).as_secs_f64() * 1_000_000.0,
    );
    println!(
        "  size_delta_bytes={}",
        json_state_size as isize - message_pack_state_size as isize,
    );
}

fn build_representative_projection() -> UiGridProjectionEnvelope<UiGridProjection> {
    let rows = (0..1000)
        .map(|index| {
            json!({
                "id": format!("row-{index}"),
                "symbol": format!("SYM{index:04}"),
                "sector": if index % 2 == 0 { "Tech" } else { "Finance" },
                "price": 100 + index,
                "volume": 1_000 + (index * 25),
            })
        })
        .collect::<Vec<Value>>();

    let options: GridOptions = serde_json::from_value(json!({
        "id": "ffi-benchmark-grid",
        "data": rows,
        "columnDefs": [
            { "name": "symbol" },
            { "name": "sector" },
            { "name": "price" },
            { "name": "volume" }
        ],
        "enableSorting": true,
        "enableGrouping": true,
        "enableFiltering": true,
        "enablePagination": true,
        "paginationCurrentPage": 2,
        "paginationPageSize": 50
    }))
    .expect("benchmark options should parse");

    let visible_columns = order_visible_columns(&options.column_defs);
    let pipeline = build_grid_pipeline(&BuildGridPipelineContext {
        options: options.clone(),
        columns: visible_columns.clone(),
        active_filters: BTreeMap::from([("sector".to_string(), "Tech".to_string())]),
        sort_state: SortState {
            column_name: Some("price".to_string()),
            direction: SortDirection::Desc,
        },
        group_by_columns: vec!["sector".to_string()],
        collapsed_groups: BTreeMap::new(),
        hidden_row_reasons: BTreeMap::new(),
        expanded_rows: BTreeMap::new(),
        expanded_tree_rows: BTreeMap::new(),
        current_page: 2,
        page_size: 50,
        row_size: 44,
    });

    UiGridProjectionEnvelope {
        engine_contract_version: ENGINE_CONTRACT_VERSION.to_string(),
        c_abi_version: C_ABI_VERSION.to_string(),
        projection_schema_version: PROJECTION_SCHEMA_VERSION.to_string(),
        command_schema_version: COMMAND_SCHEMA_VERSION.to_string(),
        payload: UiGridProjection {
            options,
            visible_columns,
            pipeline,
            active_filters: BTreeMap::from([("sector".to_string(), "Tech".to_string())]),
            sort_state: SortState {
                column_name: Some("price".to_string()),
                direction: SortDirection::Desc,
            },
            group_by_columns: vec!["sector".to_string()],
            collapsed_groups: BTreeMap::new(),
            expanded_rows: BTreeMap::new(),
            expanded_tree_rows: BTreeMap::new(),
            pinned_columns: BTreeMap::from([("symbol".to_string(), "left".to_string())]),
            current_page: 2,
            page_size: 50,
            row_size: 44,
        },
    }
}

fn build_representative_saved_state() -> ui_grid_core::models::GridSavedState {
    ui_grid_core::models::GridSavedState {
        column_order: vec![
            "symbol".to_string(),
            "sector".to_string(),
            "price".to_string(),
            "volume".to_string(),
        ],
        filters: BTreeMap::from([("sector".to_string(), "Tech".to_string())]),
        sort: Some(SortState {
            column_name: Some("price".to_string()),
            direction: SortDirection::Desc,
        }),
        grouping: vec!["sector".to_string()],
        pagination: Some(ui_grid_core::models::GridSavedPaginationState {
            pagination_current_page: 2,
            pagination_page_size: 50,
        }),
        expandable: BTreeMap::from([("row-42".to_string(), true)]),
        tree_view: BTreeMap::from([("row-7".to_string(), true)]),
        pinning: BTreeMap::from([("symbol".to_string(), "left".to_string())]),
        column_width_overrides: BTreeMap::new(),
    }
}

fn benchmark_json(
    envelope: &UiGridProjectionEnvelope<UiGridProjection>,
    iterations: usize,
) -> (usize, Duration, Duration) {
    let mut last = Vec::new();
    let encode_start = Instant::now();
    for _ in 0..iterations {
        last = serde_json::to_vec(envelope).expect("json encode should succeed");
    }
    let encode_elapsed = encode_start.elapsed();

    let decode_start = Instant::now();
    for _ in 0..iterations {
        let _: UiGridProjectionEnvelope<UiGridProjection> =
            serde_json::from_slice(&last).expect("json decode should succeed");
    }
    let decode_elapsed = decode_start.elapsed();

    (last.len(), encode_elapsed, decode_elapsed)
}

fn benchmark_message_pack(
    envelope: &UiGridProjectionEnvelope<UiGridProjection>,
    iterations: usize,
) -> (usize, Duration, Duration) {
    let mut last = Vec::new();
    let encode_start = Instant::now();
    for _ in 0..iterations {
        last = rmp_serde::to_vec_named(envelope).expect("messagepack encode should succeed");
    }
    let encode_elapsed = encode_start.elapsed();

    let decode_start = Instant::now();
    for _ in 0..iterations {
        let _: UiGridProjectionEnvelope<UiGridProjection> =
            rmp_serde::from_slice(&last).expect("messagepack decode should succeed");
    }
    let decode_elapsed = decode_start.elapsed();

    (last.len(), encode_elapsed, decode_elapsed)
}

fn benchmark_saved_state_json(
    state: &ui_grid_core::models::GridSavedState,
    iterations: usize,
) -> (usize, Duration, Duration) {
    let mut last = Vec::new();
    let encode_start = Instant::now();
    for _ in 0..iterations {
        last = serde_json::to_vec(state).expect("json state encode should succeed");
    }
    let encode_elapsed = encode_start.elapsed();

    let decode_start = Instant::now();
    for _ in 0..iterations {
        let _: ui_grid_core::models::GridSavedState =
            serde_json::from_slice(&last).expect("json state decode should succeed");
    }
    let decode_elapsed = decode_start.elapsed();

    (last.len(), encode_elapsed, decode_elapsed)
}

fn benchmark_saved_state_message_pack(
    state: &ui_grid_core::models::GridSavedState,
    iterations: usize,
) -> (usize, Duration, Duration) {
    let mut last = Vec::new();
    let encode_start = Instant::now();
    for _ in 0..iterations {
        last = rmp_serde::to_vec_named(state).expect("messagepack state encode should succeed");
    }
    let encode_elapsed = encode_start.elapsed();

    let decode_start = Instant::now();
    for _ in 0..iterations {
        let _: ui_grid_core::models::GridSavedState =
            rmp_serde::from_slice(&last).expect("messagepack state decode should succeed");
    }
    let decode_elapsed = decode_start.elapsed();

    (last.len(), encode_elapsed, decode_elapsed)
}

fn duration_per_iteration(duration: Duration, iterations: usize) -> Duration {
    Duration::from_secs_f64(duration.as_secs_f64() / iterations as f64)
}

fn order_visible_columns(columns: &[GridColumnDef]) -> Vec<GridColumnDef> {
    columns
        .iter()
        .filter(|column| column.visible)
        .cloned()
        .collect()
}
