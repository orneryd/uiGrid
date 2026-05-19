use crate::{
    constants::SortDirection,
    models::{GridColumnDef, GridOptions, GridRow, SortState},
    row_sorter::{SortKind, compare_values, guess_sort_kind},
    utils::get_cell_value,
};

pub fn sort_grid_rows(
    rows: &[GridRow],
    columns: &[GridColumnDef],
    options: &GridOptions,
    sort_state: &SortState,
) -> Vec<GridRow> {
    if !options.enable_sorting || sort_state.direction == SortDirection::None {
        return rows.to_vec();
    }

    let Some(column_name) = &sort_state.column_name else {
        return rows.to_vec();
    };

    let Some(column) = columns
        .iter()
        .find(|column| column.name == *column_name && column.sortable && column.enable_sorting)
    else {
        return rows.to_vec();
    };

    let kind = guess_sort_kind(
        column,
        &rows
            .iter()
            .map(|row| row.entity.clone())
            .collect::<Vec<_>>(),
    );
    // Column has a JS `sortingAlgorithm` callback the Rust core can't
    // invoke — leave rows in input order so the wasm bridge can re-sort
    // host-side. Skipping the sort entirely is a clarity win (and saves
    // a stable-sort pass that would only return Equal for every pair).
    if matches!(kind, SortKind::DeferToHost) {
        return rows.to_vec();
    }
    let mut sorted = rows.to_vec();
    sorted.sort_by(|left, right| {
        let left_value = get_cell_value(&left.entity, column);
        let right_value = get_cell_value(&right.entity, column);
        let ordering = compare_values(kind, &left_value, &right_value);
        if sort_state.direction == SortDirection::Desc {
            ordering.reverse()
        } else {
            ordering
        }
    });
    sorted
}
