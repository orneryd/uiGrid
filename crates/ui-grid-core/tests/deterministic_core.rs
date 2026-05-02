use std::collections::BTreeMap;

use serde_json::json;
use ui_grid_core::{
    constants::{FilterCondition, SortDirection},
    edit::{
        GridMoveDirection, begin_grid_edit_session, build_grid_focus_cell_result,
        clear_grid_edit_session, find_next_grid_cell, parse_grid_edited_value,
        should_grid_edit_on_focus, stringify_grid_editor_value,
    },
    export::{
        build_csv_export_payload, build_csv_export_payload_with, build_grid_export_context,
        export_csv_rows, export_csv_rows_with,
    },
    models::{
        BuildGridPipelineContext, DisplayItem, GridCellPosition, GridColumnDef, GridColumnType,
        GridGroupingOptions, GridIcon, GridIcons, GridLabels, GridOptions, GridRow, SortState,
    },
    pipeline::build_grid_pipeline,
    row_state::{
        add_grid_row_invisible_reason, are_all_grid_rows_expanded, clear_grid_row_invisible_reason,
        expand_all_grid_rows, expand_all_grid_tree_rows, get_grid_tree_row_children,
        toggle_grid_row_expanded, toggle_grid_tree_row_expanded,
    },
    state::{
        BuildGridSavedStateContext, build_grid_saved_state, create_grid_restore_mutation_plan,
        deserialize_grid_saved_state, deserialize_grid_saved_state_with,
        normalize_grid_saved_state, sanitize_download_filename, serialize_grid_saved_state,
        serialize_grid_saved_state_with,
    },
    tree::build_grid_rows,
    viewmodel::{resolve_grid_icons, resolve_grid_labels},
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
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            pinned_left: false,
            pinned_right: false,
            enable_pinning: true,
            width: None,
            align: None,
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
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            pinned_left: false,
            pinned_right: false,
            enable_pinning: true,
            width: None,
            align: None,
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
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            pinned_left: false,
            pinned_right: false,
            enable_pinning: true,
            width: None,
            align: None,
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
fn pipeline_filters_sorts_groups_and_paginates() {
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

        #[test]
        fn grid_column_default_keeps_global_features_enabled() {
            let column = GridColumnDef::default();

            assert!(column.visible);
            assert!(column.sortable);
            assert!(column.filterable);
            assert!(column.enable_sorting);
            assert!(column.enable_filtering);
            assert!(column.enable_grouping);
            assert!(column.enable_pinning);
        }

        #[test]
        fn grid_options_default_only_enables_sorting() {
            let options = GridOptions::default();

            assert!(options.enable_sorting);
            assert!(!options.enable_filtering);
            assert!(!options.enable_grouping);
            assert!(!options.enable_column_moving);
            assert!(!options.enable_cell_edit);
            assert!(!options.enable_cell_edit_on_focus);
            assert!(options.enable_virtualization);
            assert!(!options.enable_pagination);
            assert!(!options.enable_pagination_controls);
            assert!(!options.use_external_pagination);
            assert!(!options.enable_expandable);
            assert!(!options.enable_tree_view);
            assert!(!options.show_tree_expand_no_children);
            assert!(!options.tree_row_header_always_visible);
            assert!(!options.enable_auto_resize);
            assert!(!options.infinite_scroll_up);
            assert!(!options.enable_pinning);
            assert_eq!(options.virtualization_threshold, None);
        }

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
fn custom_export_formatters_and_payloads() {
    let rows = build_grid_rows(&base_options(), 44, &BTreeMap::new(), &BTreeMap::new());
    let columns = base_columns();
    let context = build_grid_export_context("accounts/grid", &columns[..2], &rows[..1]);

    let csv = export_csv_rows_with(context.columns, context.rows, |row, column| {
        format!("{}={}", column.name, row.entity[column.field.as_deref().unwrap_or(&column.name)])
    });
    assert_eq!(csv, "Owner,Status\n\"owner=\"\"Alice\"\"\",\"status=\"\"Active\"\"\"");

    let default_payload = build_csv_export_payload(&context);
    assert_eq!(default_payload.filename, "accounts_grid.csv");
    assert_eq!(default_payload.mime_type, "text/csv;charset=utf-8");
    assert!(default_payload.contents.starts_with("Owner,Status\n"));

    let custom_payload = build_csv_export_payload_with(&context, |row, column| {
        format!("{}:{}", column.name, row.id)
    });
    assert_eq!(custom_payload.filename, "accounts_grid.csv");
    assert_eq!(custom_payload.contents, "Owner,Status\nowner:row-1,status:row-1");
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
        pinned_columns: BTreeMap::new(),
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

    let serialized = serialize_grid_saved_state(&saved).expect("serialize saved state");
    let deserialized = deserialize_grid_saved_state(&serialized).expect("deserialize saved state");
    assert_eq!(deserialized, saved);

    let custom_serialized = serialize_grid_saved_state_with(&saved, |state| {
        state.column_order.join("|")
    });
    assert_eq!(custom_serialized, "owner|status");

    let custom_deserialized = deserialize_grid_saved_state_with("owner|status", |value| {
        Ok::<_, &'static str>(ui_grid_core::models::GridSavedState {
            column_order: value.split('|').map(str::to_string).collect(),
            ..Default::default()
        })
    })
    .expect("deserialize custom saved state");
    assert_eq!(custom_deserialized.column_order, vec!["owner", "status"]);

    let restore_plan = create_grid_restore_mutation_plan(&saved);
    assert_eq!(restore_plan.column_order, Some(vec!["owner".to_string(), "status".to_string()]));
    assert_eq!(restore_plan.filters.as_ref().unwrap().get("owner"), Some(&"Ali*".to_string()));
    assert_eq!(restore_plan.sort.as_ref().unwrap().direction, SortDirection::Desc);
    assert_eq!(restore_plan.grouping, Some(vec!["status".to_string()]));
    assert_eq!(restore_plan.pagination.as_ref().unwrap().pagination_current_page, 3);
}

#[test]
fn label_resolution_supports_i18n_overrides() {
    let spanish = GridLabels {
        sort_default: "Ordenar".to_string(),
        sort_asc: "Orden ascendente".to_string(),
        sort_desc: "Orden descendente".to_string(),
        group_column: "Agrupar por esta columna".to_string(),
        ungroup_column: "Quitar agrupacion".to_string(),
        group_collapse: "Contraer grupo".to_string(),
        group_expand: "Expandir grupo".to_string(),
        tree_collapse: "Contraer fila".to_string(),
        tree_expand: "Expandir fila".to_string(),
        expand_detail: "Expandir detalles".to_string(),
        collapse_detail: "Contraer detalles".to_string(),
        filter_placeholder: "Filtrar…".to_string(),
        filter_disabled: "Filtro deshabilitado".to_string(),
        filter_column: "Filtro".to_string(),
        pagination_previous: "Pagina anterior".to_string(),
        pagination_next: "Pagina siguiente".to_string(),
        pagination_page: "Pagina".to_string(),
        pagination_of: "de".to_string(),
        pagination_rows: "Filas por pagina".to_string(),
        empty_heading: "Sin filas coincidentes".to_string(),
        empty_description: "Ajusta filtros, agrupacion o orden.".to_string(),
        toolbar_of: "de".to_string(),
        toolbar_rows: "filas".to_string(),
        stats_visible_rows: "filas visibles".to_string(),
        group_rows_suffix: "filas".to_string(),
        pin_column: "Fijar columna".to_string(),
        pin_left: "Fijar a la izquierda".to_string(),
        pin_right: "Fijar a la derecha".to_string(),
        unpin: "Desfijar".to_string(),
    };

    let labels = resolve_grid_labels(Some(&spanish));
    assert_eq!(labels.sort_default, "Ordenar");
    assert_eq!(labels.pagination_rows, "Filas por pagina");
    assert_eq!(labels.pin_left, "Fijar a la izquierda");

    let icons = resolve_grid_icons(Some(&GridIcons {
        sort_default: GridIcon::Grip,
        sort_asc: GridIcon::SortAsc,
        sort_desc: GridIcon::SortDesc,
        group_column: GridIcon::Group,
        ungroup_column: GridIcon::Ungroup,
        group_collapse: GridIcon::ChevronDown,
        group_expand: GridIcon::ChevronRight,
        tree_collapse: GridIcon::ChevronDown,
        tree_expand: GridIcon::ChevronRight,
        expand_detail: GridIcon::ChevronDown,
        collapse_detail: GridIcon::ChevronDown,
        drag_handle: GridIcon::Grip,
        move_left: GridIcon::ChevronLeft,
        move_right: GridIcon::ChevronRight,
        pin_left: GridIcon::PinLeft,
        pin_right: GridIcon::PinRight,
        unpin: GridIcon::Unpin,
    }));
    assert_eq!(icons.drag_handle, GridIcon::Grip);
    assert_eq!(icons.pin_right, GridIcon::PinRight);
}

#[test]
fn edit_helpers_manage_focus_sessions_and_value_parsing() {
    let options = GridOptions {
        enable_cell_edit_on_focus: true,
        ..Default::default()
    };
    let editable_column = GridColumnDef {
        name: "owner".to_string(),
        r#type: GridColumnType::String,
        enable_cell_edit: true,
        ..base_columns()[0].clone()
    };

    assert!(should_grid_edit_on_focus(&options, &editable_column));

    let edit_session = begin_grid_edit_session("row-1", "owner", "Alice");
    assert_eq!(
        edit_session.focused_cell,
        GridCellPosition {
            row_id: "row-1".to_string(),
            column_name: "owner".to_string(),
        }
    );
    assert_eq!(edit_session.editing_cell, edit_session.focused_cell);
    assert_eq!(edit_session.editing_value, "Alice");

    let focus_result = build_grid_focus_cell_result(None, None, "row-1", "owner", true, true);
    assert!(focus_result.should_begin_edit);

    let duplicate_focus_result = build_grid_focus_cell_result(
        Some(&focus_result.focused_cell),
        None,
        "row-1",
        "owner",
        true,
        true,
    );
    assert!(!duplicate_focus_result.should_begin_edit);

    let cleared = clear_grid_edit_session();
    assert_eq!(cleared.0, None);
    assert!(cleared.1.is_empty());

    assert_eq!(
        stringify_grid_editor_value(&json!(true)),
        "true".to_string()
    );
    assert_eq!(stringify_grid_editor_value(&json!(null)), String::new());

    let numeric_column = GridColumnDef {
        name: "revenue".to_string(),
        r#type: GridColumnType::Number,
        enable_cell_edit: true,
        ..base_columns()[2].clone()
    };
    assert_eq!(
        parse_grid_edited_value(&numeric_column, "42", &json!(5)),
        json!(42.0)
    );
    assert_eq!(
        parse_grid_edited_value(&numeric_column, "nope", &json!(5)),
        json!(5)
    );

    let boolean_column = GridColumnDef {
        name: "active".to_string(),
        r#type: GridColumnType::Boolean,
        enable_cell_edit: true,
        enable_cell_edit_on_focus: false,
        ..GridColumnDef::default()
    };
    assert_eq!(
        parse_grid_edited_value(&boolean_column, "true", &json!(false)),
        json!(true)
    );
    assert_eq!(
        parse_grid_edited_value(&editable_column, "Taylor Morgan", &json!("Mina Patel")),
        json!("Taylor Morgan")
    );
}

#[test]
fn navigation_helpers_wrap_rows_and_skip_disallowed_cells() {
    let rows = build_grid_rows(&base_options(), 44, &BTreeMap::new(), &BTreeMap::new());
    let columns = vec![
        GridColumnDef {
            name: "name".to_string(),
            enable_cell_edit: true,
            enable_cell_edit_on_focus: false,
            ..GridColumnDef::default()
        },
        GridColumnDef {
            name: "status".to_string(),
            enable_cell_edit: false,
            enable_cell_edit_on_focus: false,
            ..GridColumnDef::default()
        },
        GridColumnDef {
            name: "owner".to_string(),
            enable_cell_edit: true,
            enable_cell_edit_on_focus: false,
            ..GridColumnDef::default()
        },
    ];

    let right = find_next_grid_cell(
        &rows,
        &columns,
        "row-1",
        "name",
        GridMoveDirection::Right,
        Some(|_row: &GridRow, column: &GridColumnDef| column.enable_cell_edit),
    );
    assert_eq!(
        right,
        Some(GridCellPosition {
            row_id: "row-1".to_string(),
            column_name: "owner".to_string(),
        })
    );

    let wrapped = find_next_grid_cell(
        &rows,
        &columns,
        "row-1",
        "owner",
        GridMoveDirection::Right,
        Option::<fn(&GridRow, &GridColumnDef) -> bool>::None,
    );
    assert_eq!(
        wrapped,
        Some(GridCellPosition {
            row_id: "row-2".to_string(),
            column_name: "name".to_string(),
        })
    );

    let left = find_next_grid_cell(
        &rows,
        &columns,
        "row-2",
        "name",
        GridMoveDirection::Left,
        Option::<fn(&GridRow, &GridColumnDef) -> bool>::None,
    );
    assert_eq!(
        left,
        Some(GridCellPosition {
            row_id: "row-1".to_string(),
            column_name: "owner".to_string(),
        })
    );

    let down = find_next_grid_cell(
        &rows,
        &columns,
        "row-1",
        "status",
        GridMoveDirection::Down,
        Option::<fn(&GridRow, &GridColumnDef) -> bool>::None,
    );
    assert_eq!(
        down,
        Some(GridCellPosition {
            row_id: "row-2".to_string(),
            column_name: "status".to_string(),
        })
    );

    let none = find_next_grid_cell(
        &rows,
        &columns,
        "row-1",
        "name",
        GridMoveDirection::Up,
        Option::<fn(&GridRow, &GridColumnDef) -> bool>::None,
    );
    assert_eq!(none, None);
}

#[test]
fn row_state_transitions() {
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
