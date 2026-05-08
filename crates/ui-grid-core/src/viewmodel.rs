use crate::{
    constants::SortDirection,
    models::{GridColumnDef, GridIcon, GridIcons, GridLabels, GridOptions, GridRow},
};

pub fn resolve_grid_labels(overrides: Option<&GridLabels>) -> GridLabels {
    overrides.cloned().unwrap_or_default()
}

pub fn resolve_grid_icons(overrides: Option<&GridIcons>) -> GridIcons {
    overrides.cloned().unwrap_or_default()
}

pub fn is_grid_tree_enabled(options: &GridOptions) -> bool {
    options.enable_tree_view
}

pub fn is_grid_grouping_enabled(options: &GridOptions) -> bool {
    options.enable_grouping && !is_grid_tree_enabled(options)
}

pub fn can_grid_expand_rows(options: &GridOptions) -> bool {
    options.enable_expandable
}

pub fn is_grid_pagination_enabled(options: &GridOptions) -> bool {
    options.enable_pagination || options.pagination_page_size.unwrap_or(0) > 0
}

pub fn should_show_grid_pagination_controls(options: &GridOptions) -> bool {
    is_grid_pagination_enabled(options) && options.enable_pagination_controls
}

pub fn is_grid_infinite_scroll_enabled(options: &GridOptions) -> bool {
    options.infinite_scroll_rows_from_end.is_some()
        || options.infinite_scroll_up
        || options.infinite_scroll_down.is_some()
}

pub fn is_grid_sorting_enabled(options: &GridOptions) -> bool {
    options.enable_sorting
}

pub fn is_grid_filtering_enabled(options: &GridOptions) -> bool {
    options.enable_filtering
}

pub fn can_grid_move_columns(options: &GridOptions) -> bool {
    options.enable_column_moving
}

pub fn can_grid_resize_columns(options: &GridOptions) -> bool {
    options.enable_column_resizing
}

pub fn is_grid_primary_column(visible_columns: &[GridColumnDef], column: &GridColumnDef) -> bool {
    visible_columns
        .first()
        .is_some_and(|candidate| candidate.name == column.name)
}

pub fn is_grid_column_sortable(options: &GridOptions, column: &GridColumnDef) -> bool {
    is_grid_sorting_enabled(options) && column.sortable && column.enable_sorting
}

pub fn is_grid_column_filterable(options: &GridOptions, column: &GridColumnDef) -> bool {
    is_grid_filtering_enabled(options) && column.filterable && column.enable_filtering
}

pub fn should_show_grid_tree_toggle(
    options: &GridOptions,
    visible_columns: &[GridColumnDef],
    row: &GridRow,
    column: &GridColumnDef,
) -> bool {
    is_grid_primary_column(visible_columns, column)
        && is_grid_tree_enabled(options)
        && (row.has_children || options.show_tree_expand_no_children)
}

pub fn should_show_grid_expand_toggle(
    options: &GridOptions,
    visible_columns: &[GridColumnDef],
    column: &GridColumnDef,
) -> bool {
    is_grid_primary_column(visible_columns, column) && can_grid_expand_rows(options)
}

pub fn grid_sort_button_label(direction: SortDirection, labels: &GridLabels) -> String {
    match direction {
        SortDirection::Asc => labels.sort_asc.clone(),
        SortDirection::Desc => labels.sort_desc.clone(),
        SortDirection::None => labels.sort_default.clone(),
    }
}

pub fn grid_sort_button_icon(direction: SortDirection, icons: &GridIcons) -> GridIcon {
    match direction {
        SortDirection::Asc => icons.sort_asc.clone(),
        SortDirection::Desc => icons.sort_desc.clone(),
        SortDirection::None => icons.sort_default.clone(),
    }
}

pub fn grid_sort_aria_sort(direction: SortDirection) -> String {
    match direction {
        SortDirection::Asc => "ascending".to_string(),
        SortDirection::Desc => "descending".to_string(),
        SortDirection::None => "none".to_string(),
    }
}

pub fn grid_grouping_button_label(is_grouped: bool, labels: &GridLabels) -> String {
    if is_grouped {
        labels.ungroup_column.clone()
    } else {
        labels.group_column.clone()
    }
}

pub fn grid_grouping_button_icon(is_grouped: bool, icons: &GridIcons) -> GridIcon {
    if is_grouped {
        icons.ungroup_column.clone()
    } else {
        icons.group_column.clone()
    }
}

pub fn grid_filter_placeholder(is_filterable: bool, labels: &GridLabels) -> String {
    if is_filterable {
        labels.filter_placeholder.clone()
    } else {
        labels.filter_disabled.clone()
    }
}

pub fn grid_group_disclosure_label(collapsed: bool, labels: &GridLabels) -> String {
    if collapsed {
        labels.group_expand.clone()
    } else {
        labels.group_collapse.clone()
    }
}

pub fn grid_group_disclosure_icon(collapsed: bool, icons: &GridIcons) -> GridIcon {
    if collapsed {
        icons.group_expand.clone()
    } else {
        icons.group_collapse.clone()
    }
}

pub fn grid_editor_input_type(column: &GridColumnDef) -> String {
    match column.r#type {
        crate::models::GridColumnType::Number => "number".to_string(),
        crate::models::GridColumnType::Date => "date".to_string(),
        crate::models::GridColumnType::String
        | crate::models::GridColumnType::Boolean
        | crate::models::GridColumnType::Object => "text".to_string(),
    }
}

pub fn grid_column_width(column: &GridColumnDef) -> String {
    column
        .width
        .clone()
        .unwrap_or_else(|| "minmax(11rem, 1fr)".to_string())
}

pub fn grid_cell_indent(
    options: &GridOptions,
    visible_columns: &[GridColumnDef],
    row: &GridRow,
    column: &GridColumnDef,
) -> String {
    if !is_grid_primary_column(visible_columns, column) || !is_grid_tree_enabled(options) {
        return "0px".to_string();
    }

    format!("{}px", row.tree_level * options.tree_indent.unwrap_or(10))
}

pub fn grid_tree_toggle_label(expanded: bool, labels: &GridLabels) -> String {
    if expanded {
        labels.tree_collapse.clone()
    } else {
        labels.tree_expand.clone()
    }
}

pub fn grid_tree_toggle_icon(expanded: bool, icons: &GridIcons) -> GridIcon {
    if expanded {
        icons.tree_collapse.clone()
    } else {
        icons.tree_expand.clone()
    }
}

pub fn grid_expand_toggle_label(expanded: bool, labels: &GridLabels) -> String {
    if expanded {
        labels.collapse_detail.clone()
    } else {
        labels.expand_detail.clone()
    }
}

pub fn grid_expand_toggle_icon(expanded: bool, icons: &GridIcons) -> GridIcon {
    if expanded {
        icons.collapse_detail.clone()
    } else {
        icons.expand_detail.clone()
    }
}

pub fn grid_drag_handle_icon(icons: &GridIcons) -> GridIcon {
    icons.drag_handle.clone()
}

pub fn grid_move_left_icon(icons: &GridIcons) -> GridIcon {
    icons.move_left.clone()
}

pub fn grid_move_right_icon(icons: &GridIcons) -> GridIcon {
    icons.move_right.clone()
}

pub fn grid_pin_left_icon(icons: &GridIcons) -> GridIcon {
    icons.pin_left.clone()
}

pub fn grid_pin_right_icon(icons: &GridIcons) -> GridIcon {
    icons.pin_right.clone()
}

pub fn grid_unpin_icon(icons: &GridIcons) -> GridIcon {
    icons.unpin.clone()
}

pub fn is_grid_column_grouped(group_by_columns: &[String], column: &GridColumnDef) -> bool {
    group_by_columns.iter().any(|name| name == &column.name)
}

pub fn is_grid_tree_row_expanded(
    expanded_tree_rows: &std::collections::BTreeMap<String, bool>,
    row: &GridRow,
) -> bool {
    expanded_tree_rows.get(&row.id).copied().unwrap_or(false)
}

pub fn grid_tree_toggle_label_for_row(
    expanded_tree_rows: &std::collections::BTreeMap<String, bool>,
    row: &GridRow,
    labels: &GridLabels,
) -> String {
    grid_tree_toggle_label(is_grid_tree_row_expanded(expanded_tree_rows, row), labels)
}

pub fn grid_expand_toggle_label_for_row(row: &GridRow, labels: &GridLabels) -> String {
    grid_expand_toggle_label(row.expanded, labels)
}
