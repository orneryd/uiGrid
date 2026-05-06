#include "ui_grid_lvgl_theme.h"

static ui_grid_lvgl_theme_t build_theme(
    uint32_t border_color,
    uint32_t header_background,
    uint32_t pinned_header_background,
    uint32_t row_odd,
    uint32_t row_even,
    uint32_t row_hover,
    uint32_t pinned_row_background,
    uint32_t cell_color,
    uint32_t muted_color,
    uint32_t surface,
    uint32_t accent,
    uint32_t pinned_indicator,
    uint32_t control_hover_background,
    uint32_t control_active_background,
    uint32_t group_background,
    float radius
) {
    ui_grid_lvgl_theme_t theme = {
        .border_color = border_color,
        .header_background = header_background,
        .pinned_header_background = pinned_header_background,
        .row_odd = row_odd,
        .row_even = row_even,
        .row_hover = row_hover,
        .pinned_row_background = pinned_row_background,
        .cell_color = cell_color,
        .muted_color = muted_color,
        .surface = surface,
        .accent = accent,
        .pinned_indicator = pinned_indicator,
        .control_hover_background = control_hover_background,
        .control_active_background = control_active_background,
        .group_background = group_background,
        .radius = radius,
        .header_weight = 700.0f,
        .cell_padding_y = 12.0f,
        .cell_padding_x = 16.0f,
        .header_padding_y = 10.0f,
        .header_padding_x = 16.0f,
        .filter_padding_y = 8.0f,
        .group_padding_y = 10.0f,
        .group_indent_per_depth = 20.0f,
        .tree_indent_per_level = 20.0f,
        .row_height = 44.0f,
    };
    return theme;
}

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_default_light(void) {
    return build_theme(
        0xd4d4d8,
        0xf3f4f6,
        0xe4eeff,
        0xfcfcfd,
        0xf7f7f8,
        0xeef4ff,
        0xf1f6ff,
        0x111827,
        0x6b7280,
        0xffffff,
        0x2563eb,
        0x2563eb,
        0xe8efff,
        0xdbe7ff,
        0xeceff3,
        4.0f
    );
}

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_default_dark(void) {
    return build_theme(
        0x94bed2,
        0x112434,
        0x122c42,
        0x0b1824,
        0x0f2231,
        0x143247,
        0x122839,
        0xebf5f9,
        0x89a1b2,
        0x0b1824,
        0x67e8f9,
        0x67e8f9,
        0x113543,
        0x184454,
        0x0f3140,
        4.0f
    );
}

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_wireframe_dark(void) {
    return build_theme(
        0x5dff9a,
        0x0a150f,
        0x0f1d14,
        0x07100b,
        0x0b1710,
        0x0f2617,
        0x0c1b12,
        0xc7ffdc,
        0x79c89c,
        0x07100b,
        0x5dff9a,
        0x5dff9a,
        0x0f2617,
        0x15341f,
        0x0d1e14,
        0.0f
    );
}

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_wireframe_light(void) {
    return build_theme(
        0x14804a,
        0xedfdf1,
        0xe1f7e7,
        0xfbfffc,
        0xf3fff6,
        0xe5fbea,
        0xedfbf1,
        0x113723,
        0x4c7d64,
        0xfbfffc,
        0x14804a,
        0x14804a,
        0xe0f5e8,
        0xd1efdc,
        0xe7f8ea,
        0.0f
    );
}

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_from_preset(ui_grid_lvgl_theme_preset_t preset) {
    switch (preset) {
        case UI_GRID_LVGL_THEME_DEFAULT_DARK:
            return ui_grid_lvgl_theme_default_dark();
        case UI_GRID_LVGL_THEME_DEFAULT_LIGHT:
            return ui_grid_lvgl_theme_default_light();
        case UI_GRID_LVGL_THEME_WIREFRAME_DARK:
            return ui_grid_lvgl_theme_wireframe_dark();
        case UI_GRID_LVGL_THEME_WIREFRAME_LIGHT:
            return ui_grid_lvgl_theme_wireframe_light();
    }

    return ui_grid_lvgl_theme_default_dark();
}

const char *ui_grid_lvgl_theme_preset_label(ui_grid_lvgl_theme_preset_t preset) {
    switch (preset) {
        case UI_GRID_LVGL_THEME_DEFAULT_DARK:
            return "Dark";
        case UI_GRID_LVGL_THEME_DEFAULT_LIGHT:
            return "Light";
        case UI_GRID_LVGL_THEME_WIREFRAME_DARK:
            return "Wireframe Dark";
        case UI_GRID_LVGL_THEME_WIREFRAME_LIGHT:
            return "Wireframe Light";
    }

    return "Dark";
}