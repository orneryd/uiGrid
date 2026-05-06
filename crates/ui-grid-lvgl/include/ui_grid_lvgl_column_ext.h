#ifndef UI_GRID_LVGL_COLUMN_EXT_H
#define UI_GRID_LVGL_COLUMN_EXT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "ui_grid_lvgl_theme.h"

#ifdef __cplusplus
extern "C" {
#endif

struct ui_grid_lvgl_cell_paint_context;
typedef const char *(*ui_grid_lvgl_lookup_value_fn)(
    const struct ui_grid_lvgl_cell_paint_context *ctx,
    const char *column_name
);

typedef struct ui_grid_lvgl_cell_context {
    const char *value_text;
    const char *row_id;
    const char *column_name;
    const ui_grid_lvgl_theme_t *theme;
    size_t row_index;
} ui_grid_lvgl_cell_context_t;

typedef struct ui_grid_lvgl_cell_paint {
    uint32_t bg_color;
    uint8_t bg_opa;
    uint32_t text_color;
    bool override_bg;
    bool override_text;
} ui_grid_lvgl_cell_paint_t;

typedef struct ui_grid_lvgl_cell_paint_context {
    const char *value_text;
    const char *row_id;
    const char *column_name;
    const ui_grid_lvgl_theme_t *theme;
    size_t row_index;
    ui_grid_lvgl_lookup_value_fn lookup_value;
    void *lookup_state;
} ui_grid_lvgl_cell_paint_context_t;

typedef struct ui_grid_lvgl_header_controls_context {
    const char *column_name;
    const ui_grid_lvgl_theme_t *theme;
    bool is_grouped;
    int sort_direction;
    const char *pin_direction;
    bool can_sort;
    bool can_group;
    bool can_pin;
    bool can_move;
} ui_grid_lvgl_header_controls_context_t;

typedef bool (*ui_grid_lvgl_formatter_fn)(
    const ui_grid_lvgl_cell_context_t *context,
    char *buffer,
    size_t buffer_len,
    void *user_data
);

typedef bool (*ui_grid_lvgl_header_label_fn)(
    const ui_grid_lvgl_header_controls_context_t *context,
    char *buffer,
    size_t buffer_len,
    void *user_data
);

typedef bool (*ui_grid_lvgl_cell_painter_fn)(
    const ui_grid_lvgl_cell_paint_context_t *context,
    ui_grid_lvgl_cell_paint_t *out_paint,
    void *user_data
);

typedef struct ui_grid_lvgl_column_ext {
    const char *column_name;
    ui_grid_lvgl_formatter_fn formatter;
    ui_grid_lvgl_header_label_fn header_label_renderer;
    ui_grid_lvgl_cell_painter_fn cell_painter;
    void *user_data;
} ui_grid_lvgl_column_ext_t;

#ifdef __cplusplus
}
#endif

#endif