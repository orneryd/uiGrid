use std::collections::{BTreeMap, BTreeSet};

use serde_json::Value;

use crate::{
    filtering::{clear_grid_filter_reasons, matches_grid_row_filters},
    models::{GridColumnDef, GridOptions, GridRecord, GridRow, SortState},
    sorting::sort_grid_rows,
    utils::get_path_value,
};

pub fn is_tree_enabled(options: &GridOptions) -> bool {
    options.enable_tree_view
}

fn get_tree_children(options: &GridOptions, entity: &GridRecord) -> Vec<GridRecord> {
    if !is_tree_enabled(options) {
        return Vec::new();
    }

    let children_field = options.tree_children_field.as_deref().unwrap_or("children");
    match get_path_value(entity, children_field) {
        Some(Value::Array(values)) => values,
        _ => Vec::new(),
    }
}

fn resolve_row_id(options: &GridOptions, entity: &GridRecord, index: usize) -> String {
    if let Some(field) = &options.row_id_field {
        if let Some(Value::String(id)) = get_path_value(entity, field) {
            return id;
        }
    }

    format!("{}-{}", options.id, index)
}

fn create_row(
    options: &GridOptions,
    entity: &GridRecord,
    index: usize,
    row_size: usize,
    hidden_row_reasons: &BTreeMap<String, Vec<String>>,
    tree_level: usize,
    parent_id: Option<String>,
    child_count: usize,
    expanded: bool,
) -> GridRow {
    let row_id = resolve_row_id(options, entity, index);
    let mut row = GridRow::new(row_id.clone(), entity.clone(), index, row_size);
    row.tree_level = tree_level;
    row.parent_id = parent_id;
    row.child_count = child_count;
    row.has_children = child_count > 0;
    row.expanded = expanded;
    row.expanded_row_height = options.expandable_row_height.unwrap_or(150);

    if let Some(reasons) = hidden_row_reasons.get(&row_id) {
        for reason in reasons {
            row.set_this_row_invisible(reason.clone());
        }
    }

    row
}

pub fn build_grid_rows(
    options: &GridOptions,
    row_size: usize,
    hidden_row_reasons: &BTreeMap<String, Vec<String>>,
    expanded_rows: &BTreeMap<String, bool>,
) -> Vec<GridRow> {
    let mut rows = Vec::new();
    let mut next_index = 0usize;

    fn visit(
        rows: &mut Vec<GridRow>,
        next_index: &mut usize,
        entities: &[GridRecord],
        options: &GridOptions,
        row_size: usize,
        hidden_row_reasons: &BTreeMap<String, Vec<String>>,
        expanded_rows: &BTreeMap<String, bool>,
        tree_level: usize,
        parent_id: Option<String>,
    ) {
        for entity in entities {
            let child_entities = get_tree_children(options, entity);
            let row_id = resolve_row_id(options, entity, *next_index);
            let row = create_row(
                options,
                entity,
                *next_index,
                row_size,
                hidden_row_reasons,
                tree_level,
                parent_id.clone(),
                child_entities.len(),
                expanded_rows.get(&row_id).copied().unwrap_or(false),
            );

            *next_index += 1;
            let parent = row.id.clone();
            rows.push(row);

            if is_tree_enabled(options) && !child_entities.is_empty() {
                visit(
                    rows,
                    next_index,
                    &child_entities,
                    options,
                    row_size,
                    hidden_row_reasons,
                    expanded_rows,
                    tree_level + 1,
                    Some(parent),
                );
            }
        }
    }

    visit(
        &mut rows,
        &mut next_index,
        &options.data,
        options,
        row_size,
        hidden_row_reasons,
        expanded_rows,
        0,
        None,
    );
    rows
}

pub fn filter_and_flatten_grid_tree_rows(
    rows: &[GridRow],
    columns: &[GridColumnDef],
    options: &GridOptions,
    active_filters: &BTreeMap<String, String>,
    expanded_tree_rows: &BTreeMap<String, bool>,
    sort_state: &SortState,
) -> Vec<GridRow> {
    let mut rows_by_parent: BTreeMap<Option<String>, Vec<GridRow>> = BTreeMap::new();
    for row in rows {
        rows_by_parent
            .entry(row.parent_id.clone())
            .or_default()
            .push(row.clone());
    }

    let mut included = BTreeSet::new();

    fn visit(
        row: &GridRow,
        rows_by_parent: &BTreeMap<Option<String>, Vec<GridRow>>,
        included: &mut BTreeSet<String>,
        columns: &[GridColumnDef],
        options: &GridOptions,
        active_filters: &BTreeMap<String, String>,
    ) -> bool {
        let manually_hidden = !row.visible
            && row
                .invisible_reasons
                .iter()
                .any(|reason| !reason.starts_with("filter:"));
        if manually_hidden {
            return false;
        }

        let children = rows_by_parent
            .get(&Some(row.id.clone()))
            .cloned()
            .unwrap_or_default();
        let mut child_included = false;
        for child in children {
            child_included = visit(
                &child,
                rows_by_parent,
                included,
                columns,
                options,
                active_filters,
            ) || child_included;
        }

        let mut current = row.clone();
        let self_included =
            matches_grid_row_filters(&mut current, columns, options, active_filters);
        if child_included {
            clear_grid_filter_reasons(&mut current);
        }

        let include = current.visible && (self_included || child_included);
        if include {
            included.insert(current.id);
        }
        include
    }

    for root_row in rows_by_parent.get(&None).cloned().unwrap_or_default() {
        visit(
            &root_row,
            &rows_by_parent,
            &mut included,
            columns,
            options,
            active_filters,
        );
    }

    let mut flattened = Vec::new();

    fn flatten(
        parent_id: Option<String>,
        rows_by_parent: &BTreeMap<Option<String>, Vec<GridRow>>,
        included: &BTreeSet<String>,
        flattened: &mut Vec<GridRow>,
        columns: &[GridColumnDef],
        options: &GridOptions,
        expanded_tree_rows: &BTreeMap<String, bool>,
        sort_state: &SortState,
    ) {
        let siblings = sort_grid_rows(
            &rows_by_parent
                .get(&parent_id)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter(|row| included.contains(&row.id))
                .collect::<Vec<_>>(),
            columns,
            options,
            sort_state,
        );

        for row in siblings {
            flattened.push(row.clone());
            if row.has_children && expanded_tree_rows.get(&row.id).copied().unwrap_or(false) {
                flatten(
                    Some(row.id.clone()),
                    rows_by_parent,
                    included,
                    flattened,
                    columns,
                    options,
                    expanded_tree_rows,
                    sort_state,
                );
            }
        }
    }

    flatten(
        None,
        &rows_by_parent,
        &included,
        &mut flattened,
        columns,
        options,
        expanded_tree_rows,
        sort_state,
    );
    flattened
}
