use std::collections::BTreeMap;

use serde_json::json;
use ui_grid_core::{
    constants::{FilterCondition, SortDirection},
    export::export_csv_rows,
    models::{
        BuildGridPipelineContext, DisplayItem, GridColumnDef, GridColumnType, GridGroupingOptions,
        GridOptions, GridRow, SortState,
    },
    pipeline::build_grid_pipeline,
    row_state::{
        add_grid_row_invisible_reason, are_all_grid_rows_expanded, clear_grid_row_invisible_reason,
        expand_all_grid_rows, expand_all_grid_tree_rows, get_grid_tree_row_children,
        toggle_grid_row_expanded, toggle_grid_tree_row_expanded,
    },
    state::{
        BuildGridSavedStateContext, build_grid_saved_state, normalize_grid_saved_state,
        sanitize_download_filename,
    },
    tree::build_grid_rows,
};
use ui_grid_fixtures::{sample_rows, sample_tree_rows};

fn base_columns() -> Vec<GridColumnDef> {
    vec![
        GridColumnDef {
            name: "owner".to_string(),
            display_name: Some("Owner".to_string()),
            field: Some("owner".to_string()),
            r#type: GridColumnType::String,
            visible: true,
            sortable: true,
            filterable: true,
            enable_sorting: true,
            enable_filtering: true,
            enable_grouping: true,
            sort: None,
            filter: Some(ui_grid_core::models::GridFilterDescriptor {
                term: None,
                condition: Some(FilterCondition::Contains),
                ..Default::default()
            }),
        },
        GridColumnDef {
            name: "status".to_string(),
            display_name: Some("Status".to_string()),
            field: Some("status".to_string()),
            r#type: GridColumnType::String,
            visible: true,
            sortable: true,
            filterable: true,
            enable_sorting: true,
            enable_filtering: true,
            enable_grouping: true,
            sort: None,
            filter: Some(ui_grid_core::models::GridFilterDescriptor {
                term: None,
                condition: Some(FilterCondition::Contains),
                ..Default::default()
            }),
        },
        GridColumnDef {
            name: "revenue".to_string(),
            display_name: Some("Revenue".to_string()),
            field: Some("revenue".to_string()),
            r#type: GridColumnType::Number,
            visible: true,
            sortable: true,
            filterable: true,
            enable_sorting: true,
            enable_filtering: true,
            enable_grouping: true,
            sort: None,
            filter: Some(ui_grid_core::models::GridFilterDescriptor {
                term: None,
                condition: Some(FilterCondition::GreaterThanOrEqual),
                ..Default::default()
            }),
        },
    ]
}

fn base_options() -> GridOptions {
    GridOptions {
        id: "accounts".to_string(),
        data: sample_rows(),
        column_defs: base_columns(),
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: true,
        enable_virtualization: true,
        enable_pagination: true,
        pagination_page_size: Some(2),
        pagination_current_page: Some(1),
        grouping: Some(GridGroupingOptions {
            group_by: vec!["status".to_string()],
            start_collapsed: false,
        }),
        virtualization_threshold: Some(3),
        row_id_field: Some("id".to_string()),
        ..Default::default()
    }
}

fn display_summary(items: &[DisplayItem]) -> Vec<String> {
    items
        .iter()
        .map(|item| match item {
            DisplayItem::Group(group) => format!(
                "group:{}:{}:{}:{}",
                group.field, group.label, group.count, group.collapsed
            ),
            DisplayItem::Row(row) => format!("row:{}:{}", row.id, row.visible_index),
            DisplayItem::Expandable(expandable) => format!("expandable:{}", expandable.id),
        })
        .collect()
}

#[test]
fn pipeline_filters_sorts_groups_and_paginates_deterministically() {
    let options = base_options();
    let context = BuildGridPipelineContext {
        options: options.clone(),
        columns: base_columns(),
        active_filters: BTreeMap::from([("owner".to_string(), "Ali*".to_string())]),
        sort_state: SortState {
            column_name: Some("revenue".to_string()),
            direction: SortDirection::Desc,
        },
        group_by_columns: vec!["status".to_string()],
        current_page: 1,
        page_size: 2,
        row_size: 44,
        ..Default::default()
    };

    let result = build_grid_pipeline(&context);

    assert_eq!(result.total_items, 2);
    assert_eq!(
        result
            .visible_rows
            .iter()
            .map(|row| row.id.as_str())
            .collect::<Vec<_>>(),
        vec!["row-3", "row-1"]
    );
    assert!(result.virtualization_enabled);
    assert_eq!(
        display_summary(&result.display_items),
        vec![
            "group:status:Active:2:false".to_string(),
            "row:row-3:0".to_string(),
            "row:row-1:1".to_string(),
        ]
    );
    assert!(result.pipeline_ms >= 0.0);
}

#[test]
fn tree_pipeline_preserves_matching_parents_and_expanded_children() {
    let mut options = base_options();
    options.id = "tree-grid".to_string();
    options.data = sample_tree_rows();
    options.enable_tree_view = true;
    options.enable_grouping = false;
    options.enable_pagination = false;

    let context = BuildGridPipelineContext {
        options,
        columns: base_columns(),
        active_filters: BTreeMap::from([("owner".to_string(), "Ali*".to_string())]),
        sort_state: SortState {
            column_name: Some("owner".to_string()),
            direction: SortDirection::Asc,
        },
        expanded_tree_rows: BTreeMap::from([("acct-1".to_string(), true)]),
        current_page: 1,
        page_size: 20,
        row_size: 44,
        ..Default::default()
    };

    let result = build_grid_pipeline(&context);
    let ids = result
        .visible_rows
        .iter()
        .map(|row| row.id.clone())
        .collect::<Vec<_>>();
    assert_eq!(ids, vec!["acct-1", "acct-1-1", "acct-1-2"]);
    assert_eq!(result.display_items.len(), 3);
    assert_eq!(
        display_summary(&result.display_items),
        vec![
            "row:acct-1:0".to_string(),
            "row:acct-1-1:1".to_string(),
            "row:acct-1-2:2".to_string(),
        ]
    );
}

#[test]
fn csv_export_quotes_and_sanitizes_formula_like_values() {
    let mut rows = build_grid_rows(&base_options(), 44, &BTreeMap::new(), &BTreeMap::new());
    rows[0].entity["owner"] = json!("=SUM(A1:A2)");

    let csv = export_csv_rows(&base_columns()[..2], &rows[..1]);
    assert_eq!(csv, "Owner,Status\n'=SUM(A1:A2),Active");
}

#[test]
fn save_state_and_normalization_deeply_assert_results() {
    let saved = build_grid_saved_state(BuildGridSavedStateContext {
        column_order: vec!["owner".to_string(), "status".to_string()],
        active_filters: BTreeMap::from([("owner".to_string(), "Ali*".to_string())]),
        sort_state: SortState {
            column_name: Some("revenue".to_string()),
            direction: SortDirection::Desc,
        },
        group_by_columns: vec!["status".to_string()],
        current_page: 3,
        page_size: 0,
        total_items: 42,
        expanded_rows: BTreeMap::from([("row-1".to_string(), true)]),
        expanded_tree_rows: BTreeMap::from([("acct-1".to_string(), true)]),
    });

    assert_eq!(saved.column_order, vec!["owner", "status"]);
    assert_eq!(saved.filters.get("owner"), Some(&"Ali*".to_string()));
    assert_eq!(saved.sort.as_ref().unwrap().direction, SortDirection::Desc);
    assert_eq!(
        saved.pagination.as_ref().unwrap().pagination_current_page,
        3
    );
    assert_eq!(saved.pagination.as_ref().unwrap().pagination_page_size, 42);

    let normalized = normalize_grid_saved_state(&json!({
        "columnOrder": ["owner", 123, "__proto__", "status"],
        "filters": {"owner": "Ali*", "constructor": true},
        "sort": {"columnName": "revenue", "direction": "desc"},
        "grouping": ["status", "prototype"],
        "pagination": {"paginationCurrentPage": 2, "paginationPageSize": 25},
        "expandable": {"row-1": true, "prototype": true},
        "treeView": {"acct-1": true, "__proto__": false}
    }));

    assert_eq!(normalized.column_order, vec!["owner", "status"]);
    assert_eq!(
        normalized.filters,
        BTreeMap::from([("owner".to_string(), "Ali*".to_string())])
    );
    assert_eq!(
        normalized.sort,
        Some(SortState {
            column_name: Some("revenue".to_string()),
            direction: SortDirection::Desc,
        })
    );
    assert_eq!(normalized.grouping, vec!["status"]);
    assert_eq!(normalized.pagination.unwrap().pagination_page_size, 25);
    assert_eq!(
        normalized.expandable,
        BTreeMap::from([("row-1".to_string(), true)])
    );
    assert_eq!(
        normalized.tree_view,
        BTreeMap::from([("acct-1".to_string(), true)])
    );
    assert_eq!(
        sanitize_download_filename("Quarterly / Revenue: 2026.csv"),
        "Quarterly___Revenue__2026.csv"
    );
}

#[test]
fn row_state_transitions_are_deterministic() {
    let rows = build_grid_rows(&base_options(), 44, &BTreeMap::new(), &BTreeMap::new());
    let (expanded, expanded_rows) = toggle_grid_row_expanded(&BTreeMap::new(), "row-1");
    assert!(expanded);
    assert_eq!(expanded_rows, BTreeMap::from([("row-1".to_string(), true)]));

    let all_expanded = expand_all_grid_rows(&rows);
    assert!(are_all_grid_rows_expanded(&rows, &all_expanded));

    let mut tree_options = base_options();
    tree_options.id = "tree-grid".to_string();
    tree_options.data = sample_tree_rows();
    tree_options.enable_tree_view = true;
    let tree_rows = build_grid_rows(&tree_options, 44, &BTreeMap::new(), &BTreeMap::new());
    let (tree_expanded, next_tree_state) =
        toggle_grid_tree_row_expanded(&BTreeMap::new(), "acct-1");
    assert!(tree_expanded);
    assert_eq!(
        next_tree_state,
        BTreeMap::from([("acct-1".to_string(), true)])
    );
    assert_eq!(
        expand_all_grid_tree_rows(&tree_rows),
        BTreeMap::from([("acct-1".to_string(), true), ("acct-2".to_string(), true),])
    );
    assert_eq!(
        get_grid_tree_row_children(&tree_rows, "acct-1")
            .iter()
            .map(|row| row.id.as_str())
            .collect::<Vec<_>>(),
        vec!["acct-1-1", "acct-1-2"]
    );

    let hidden = add_grid_row_invisible_reason(&BTreeMap::new(), "row-1", "manual");
    assert_eq!(
        hidden,
        BTreeMap::from([("row-1".to_string(), vec!["manual".to_string()])])
    );
    assert_eq!(
        clear_grid_row_invisible_reason(&hidden, "row-1", "manual"),
        BTreeMap::new()
    );
}

#[test]
fn row_visibility_reasons_round_trip() {
    let mut row = GridRow::new("row-1".to_string(), json!({"id": 1}), 0, 52);
    row.set_this_row_invisible("filter");
    row.set_this_row_invisible("manual");

    assert!(!row.visible);
    assert_eq!(
        row.invisible_reasons,
        vec!["filter".to_string(), "manual".to_string()]
    );

    row.clear_this_row_invisible("filter");
    assert!(!row.visible);
    assert_eq!(row.invisible_reasons, vec!["manual".to_string()]);

    row.clear_this_row_invisible("manual");
    assert!(row.visible);
    assert!(row.invisible_reasons.is_empty());
}
