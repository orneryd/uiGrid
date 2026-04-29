use crate::models::{GridOptions, GridRow};

fn is_pagination_enabled(options: &GridOptions) -> bool {
    options.enable_pagination || options.pagination_page_size.unwrap_or_default() > 0
}

fn initial_page_size(options: &GridOptions) -> usize {
    options
        .pagination_page_size
        .or_else(|| options.pagination_page_sizes.first().copied())
        .unwrap_or(options.data.len())
}

pub fn get_effective_page_size(options: &GridOptions, page_size: usize, total_items: usize) -> usize {
    if !is_pagination_enabled(options) {
        return total_items;
    }

    let resolved_page_size = if page_size == 0 {
        initial_page_size(options)
    } else {
        page_size
    };

    if resolved_page_size == 0 {
        total_items
    } else {
        resolved_page_size
    }
}

pub fn get_total_pages_value(options: &GridOptions, total_items: usize, page_size: usize) -> usize {
    let effective_page_size = get_effective_page_size(options, page_size, total_items);
    if !is_pagination_enabled(options) || effective_page_size == 0 {
        return 1;
    }

    total_items.max(1).div_ceil(effective_page_size).max(1)
}

pub fn get_current_page_value(options: &GridOptions, current_page: usize, total_items: usize, page_size: usize) -> usize {
    current_page.max(1).min(get_total_pages_value(options, total_items, page_size))
}

pub fn get_first_row_index_value(options: &GridOptions, current_page: usize, total_items: usize, page_size: usize) -> usize {
    if !is_pagination_enabled(options) || total_items == 0 || options.use_external_pagination {
        return 0;
    }

    (get_current_page_value(options, current_page, total_items, page_size) - 1)
        * get_effective_page_size(options, page_size, total_items)
}

pub fn get_last_row_index_value(options: &GridOptions, current_page: usize, total_items: usize, page_size: usize) -> usize {
    if total_items == 0 {
        return 0;
    }

    if !is_pagination_enabled(options) || options.use_external_pagination {
        return total_items - 1;
    }

    (get_first_row_index_value(options, current_page, total_items, page_size)
        + get_effective_page_size(options, page_size, total_items))
        .min(total_items)
        - 1
}

pub fn paginate_grid_rows(
    rows: &[GridRow],
    options: &GridOptions,
    current_page: usize,
    page_size: usize,
    total_items: usize,
) -> Vec<GridRow> {
    if !is_pagination_enabled(options) || options.use_external_pagination {
        return rows.to_vec();
    }

    let resolved_page_size = get_effective_page_size(options, page_size, total_items);
    let first_row = get_first_row_index_value(options, current_page, total_items, page_size);
    rows.iter()
        .skip(first_row)
        .take(resolved_page_size)
        .cloned()
        .collect()
}

pub fn is_virtualization_enabled(options: &GridOptions, item_count: usize) -> bool {
    options.enable_virtualization && item_count >= options.virtualization_threshold.unwrap_or(40)
}

pub fn seek_grid_page(page: usize, total_pages: usize) -> usize {
    page.max(1).min(total_pages.max(1))
}

pub fn resolve_grid_page_size(page_size: usize) -> Option<usize> {
    if page_size > 0 {
        Some(page_size)
    } else {
        None
    }
}