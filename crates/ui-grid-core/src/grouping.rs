use std::collections::BTreeMap;

use crate::{
    models::{DisplayItem, ExpandableItem, GridColumnDef, GridOptions, GridRow, GroupItem, RowItem},
    utils::{get_path_value, stringify_cell_value},
};

fn is_grouping_enabled(options: &GridOptions) -> bool {
    options.enable_grouping && !options.enable_tree_view
}

fn can_expand_rows(options: &GridOptions) -> bool {
    options.enable_expandable
}

fn build_row_display_items(rows: &[GridRow], options: &GridOptions) -> Vec<DisplayItem> {
    let mut items = Vec::new();
    for (visible_index, row) in rows.iter().enumerate() {
        items.push(DisplayItem::Row(RowItem {
            id: row.id.clone(),
            row: row.clone(),
            visible_index,
        }));

        if row.expanded && can_expand_rows(options) {
            items.push(DisplayItem::Expandable(ExpandableItem {
                id: format!("{}:expandable", row.id),
                row: row.clone(),
            }));
        }
    }
    items
}

fn build_grouped_items(
    rows: &[GridRow],
    columns: &[GridColumnDef],
    options: &GridOptions,
    group_by: &[String],
    collapsed_groups: &BTreeMap<String, bool>,
    depth: usize,
    path: &str,
) -> Vec<DisplayItem> {
    if group_by.is_empty() {
        return build_row_display_items(rows, options);
    }

    let current_field = &group_by[0];
    let mut groups: BTreeMap<String, Vec<GridRow>> = BTreeMap::new();

    for row in rows {
        let value = stringify_cell_value(
            &get_path_value(&row.entity, current_field)
                .or_else(|| columns.iter().find(|column| column.name == *current_field).map(|column| crate::utils::get_cell_value(&row.entity, column)))
                .unwrap_or(serde_json::Value::Null),
        );
        let key = if value.is_empty() { "Unassigned".to_string() } else { value };
        groups.entry(key).or_default().push(row.clone());
    }

    let mut items = Vec::new();
    for (label, grouped_rows) in groups {
        let group_id = format!("{}{}:{}", path, current_field, label);
        let collapsed = collapsed_groups
            .get(&group_id)
            .copied()
            .or_else(|| options.grouping.as_ref().map(|grouping| grouping.start_collapsed))
            .unwrap_or(false);

        items.push(DisplayItem::Group(GroupItem {
            id: group_id.clone(),
            depth,
            field: current_field.clone(),
            label: label.clone(),
            count: grouped_rows.len(),
            collapsed,
        }));

        if !collapsed {
            items.extend(build_grouped_items(
                &grouped_rows,
                columns,
                options,
                &group_by[1..],
                collapsed_groups,
                depth + 1,
                &format!("{}|", group_id),
            ));
        }
    }

    items
}

pub fn build_grid_display_items(
    rows: &[GridRow],
    columns: &[GridColumnDef],
    options: &GridOptions,
    group_by: &[String],
    collapsed_groups: &BTreeMap<String, bool>,
) -> Vec<DisplayItem> {
    if options.enable_tree_view {
        return build_row_display_items(rows, options);
    }

    if !is_grouping_enabled(options) || group_by.is_empty() {
        return build_row_display_items(rows, options);
    }

    build_grouped_items(rows, columns, options, group_by, collapsed_groups, 0, "")
}