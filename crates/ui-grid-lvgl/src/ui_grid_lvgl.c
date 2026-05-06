#include "ui_grid_lvgl.h"

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef enum {
    JSMN_UNDEFINED = 0,
    JSMN_OBJECT = 1,
    JSMN_ARRAY = 2,
    JSMN_STRING = 3,
    JSMN_PRIMITIVE = 4
} jsmntype_t;

typedef struct {
    jsmntype_t type;
    int start;
    int end;
    int size;
    int parent;
} jsmntok_t;

typedef struct {
    unsigned int pos;
    unsigned int toknext;
    int toksuper;
} jsmn_parser;

enum {
    JSMN_ERROR_NOMEM = -1,
    JSMN_ERROR_INVAL = -2,
    JSMN_ERROR_PART = -3
};

typedef struct {
    char *name;
    char *label;
    char *width_text;
    bool filterable;
    bool enable_filtering;
} ui_grid_lvgl_column_t;

typedef struct {
    char *column_name;
    int width;
} ui_grid_lvgl_column_width_t;

typedef struct {
    char *column_name;
    char *side;
} ui_grid_lvgl_pinned_column_t;

typedef struct {
    char *column_name;
    char *value;
} ui_grid_lvgl_active_filter_t;

typedef struct {
    struct ui_grid_lvgl_adapter *adapter;
    char *column_name;
    lv_obj_t *container;
    lv_obj_t *drag_button;
    lv_obj_t *filter_input;
    lv_obj_t *sort_button;
    lv_obj_t *group_button;
    lv_obj_t *resize_handle;
    bool is_grouped;
    int width;
} ui_grid_lvgl_header_ref_t;

static void jsmn_init(jsmn_parser *parser) {
    parser->pos = 0;
    parser->toknext = 0;
    parser->toksuper = -1;
}

static jsmntok_t *jsmn_alloc_token(jsmn_parser *parser, jsmntok_t *tokens, size_t num_tokens) {
    if (parser->toknext >= num_tokens) {
        return NULL;
    }

    jsmntok_t *token = &tokens[parser->toknext++];
    token->start = -1;
    token->end = -1;
    token->size = 0;
    token->parent = -1;
    token->type = JSMN_UNDEFINED;
    return token;
}

static void jsmn_fill_token(jsmntok_t *token, jsmntype_t type, int start, int end) {
    token->type = type;
    token->start = start;
    token->end = end;
    token->size = 0;
}

static int jsmn_parse_primitive(jsmn_parser *parser, const char *json, size_t len, jsmntok_t *tokens, size_t num_tokens) {
    int start = (int)parser->pos;

    for (; parser->pos < len; parser->pos++) {
        char ch = json[parser->pos];
        if (ch == '\t' || ch == '\r' || ch == '\n' || ch == ' ' || ch == ',' || ch == ']' || ch == '}') {
            jsmntok_t *token = jsmn_alloc_token(parser, tokens, num_tokens);
            if (token == NULL) {
                parser->pos = (unsigned int)start;
                return JSMN_ERROR_NOMEM;
            }

            jsmn_fill_token(token, JSMN_PRIMITIVE, start, (int)parser->pos);
            token->parent = parser->toksuper;
            parser->pos--;
            return 0;
        }

        if (ch < 32 || ch >= 127) {
            parser->pos = (unsigned int)start;
            return JSMN_ERROR_INVAL;
        }
    }

    jsmntok_t *token = jsmn_alloc_token(parser, tokens, num_tokens);
    if (token == NULL) {
        parser->pos = (unsigned int)start;
        return JSMN_ERROR_NOMEM;
    }

    jsmn_fill_token(token, JSMN_PRIMITIVE, start, (int)parser->pos);
    token->parent = parser->toksuper;
    parser->pos--;
    return 0;
}

static int jsmn_parse_string(jsmn_parser *parser, const char *json, size_t len, jsmntok_t *tokens, size_t num_tokens) {
    int start = (int)parser->pos;

    parser->pos++;
    for (; parser->pos < len; parser->pos++) {
        char ch = json[parser->pos];

        if (ch == '"') {
            jsmntok_t *token = jsmn_alloc_token(parser, tokens, num_tokens);
            if (token == NULL) {
                parser->pos = (unsigned int)start;
                return JSMN_ERROR_NOMEM;
            }

            jsmn_fill_token(token, JSMN_STRING, start + 1, (int)parser->pos);
            token->parent = parser->toksuper;
            return 0;
        }

        if (ch == '\\' && parser->pos + 1 < len) {
            parser->pos++;
            switch (json[parser->pos]) {
                case '"':
                case '/':
                case '\\':
                case 'b':
                case 'f':
                case 'r':
                case 'n':
                case 't':
                    break;
                case 'u':
                    parser->pos += 4;
                    break;
                default:
                    parser->pos = (unsigned int)start;
                    return JSMN_ERROR_INVAL;
            }
        }
    }

    parser->pos = (unsigned int)start;
    return JSMN_ERROR_PART;
}

static int jsmn_parse(jsmn_parser *parser, const char *json, size_t len, jsmntok_t *tokens, unsigned int num_tokens) {
    int result;

    for (; parser->pos < len; parser->pos++) {
        char ch = json[parser->pos];
        jsmntok_t *token;

        switch (ch) {
            case '{':
            case '[':
                token = jsmn_alloc_token(parser, tokens, num_tokens);
                if (token == NULL) {
                    return JSMN_ERROR_NOMEM;
                }
                if (parser->toksuper != -1) {
                    tokens[parser->toksuper].size++;
                    token->parent = parser->toksuper;
                }
                token->type = (ch == '{') ? JSMN_OBJECT : JSMN_ARRAY;
                token->start = (int)parser->pos;
                parser->toksuper = (int)(parser->toknext - 1);
                break;

            case '}':
            case ']':
                for (int index = (int)parser->toknext - 1; index >= 0; index--) {
                    token = &tokens[index];
                    if (token->start != -1 && token->end == -1) {
                        if ((token->type == JSMN_OBJECT && ch == '}') || (token->type == JSMN_ARRAY && ch == ']')) {
                            token->end = (int)parser->pos + 1;
                            parser->toksuper = token->parent;
                            break;
                        }
                        return JSMN_ERROR_INVAL;
                    }
                }
                break;

            case '"':
                result = jsmn_parse_string(parser, json, len, tokens, num_tokens);
                if (result < 0) {
                    return result;
                }
                if (parser->toksuper != -1) {
                    tokens[parser->toksuper].size++;
                }
                break;

            case '\t':
            case '\r':
            case '\n':
            case ' ':
            case ':':
            case ',':
                break;

            default:
                result = jsmn_parse_primitive(parser, json, len, tokens, num_tokens);
                if (result < 0) {
                    return result;
                }
                if (parser->toksuper != -1) {
                    tokens[parser->toksuper].size++;
                }
                break;
        }
    }

    for (unsigned int index = parser->toknext; index > 0; index--) {
        if (tokens[index - 1].start != -1 && tokens[index - 1].end == -1) {
            return JSMN_ERROR_PART;
        }
    }

    return (int)parser->toknext;
}

struct ui_grid_lvgl_adapter {
    UiGridAbiEngine *engine;
    lv_obj_t *root;
    lv_obj_t *header_clip;
    lv_obj_t *header_row;
    lv_obj_t *table;
    lv_obj_t *footer_label;
    unsigned int row_height;
    bool use_message_pack;
    ui_grid_lvgl_theme_t theme;
    bool enable_column_resizing;
    const ui_grid_lvgl_column_ext_t *column_exts;
    size_t column_ext_count;
    char *current_sort_column;
    ui_grid_lvgl_sort_direction_t current_sort_direction;
    char **group_by_columns;
    int group_by_count;
    ui_grid_lvgl_pinned_column_t *pinned_columns;
    int pinned_column_count;
    ui_grid_lvgl_active_filter_t *active_filters;
    int active_filter_count;
    bool enable_filtering;
    bool suppress_filter_events;
    char *pending_filter_focus_column;
    uint32_t pending_filter_focus_pos;
    ui_grid_lvgl_header_ref_t *header_refs;
    int header_ref_count;
    ui_grid_lvgl_column_width_t *column_widths;
    int column_width_count;
    char *drag_source_column;
    bool drag_active;
    lv_point_t drag_start;
    char *resize_column;
    int resize_start_width;
    lv_point_t resize_start;

    /* per-display-row metadata captured at render time so click events can
     * dispatch the correct command (tree expand vs row expand vs group toggle). */
    struct {
        char *row_id;
        int kind;            /* 0=row, 1=group, 2=expandable, 3=tree-row */
        bool has_children;
        bool expanded;
        int depth;
        char *group_key;
    } *display_rows;
    int display_row_count;
    int display_row_capacity;

    /* per-cell paint cache populated by render and consumed by draw event. */
    ui_grid_lvgl_cell_paint_t *cell_paints;
    int cell_paint_rows;
    int cell_paint_cols;
    int cell_paint_capacity;

    /* current expanded tree-row id set, mirrored into setExpandedTreeRows. */
    char **expanded_tree_ids;
    int expanded_tree_count;
    int expanded_tree_capacity;

    /* current expanded (expandable) row id set. */
    char **expanded_row_ids;
    int expanded_row_count;
    int expanded_row_capacity;

    char last_error[512];
};

static void ui_grid_lvgl_set_error_text(ui_grid_lvgl_adapter_t *adapter, const char *message);
static void ui_grid_lvgl_clear_headers(ui_grid_lvgl_adapter_t *adapter);
static void ui_grid_lvgl_header_drag_event(lv_event_t *event);
static void ui_grid_lvgl_table_draw_event(lv_event_t *event);
static void ui_grid_lvgl_table_scroll_event(lv_event_t *event);
static void ui_grid_lvgl_table_clicked_event(lv_event_t *event);
static void ui_grid_lvgl_filter_event(lv_event_t *event);
static void ui_grid_lvgl_apply_theme(ui_grid_lvgl_adapter_t *adapter);

static const ui_grid_lvgl_column_ext_t *ui_grid_lvgl_find_column_ext(
    const ui_grid_lvgl_adapter_t *adapter,
    const char *column_name
) {
    if (adapter == NULL || column_name == NULL) {
        return NULL;
    }

    for (size_t index = 0; index < adapter->column_ext_count; index++) {
        const ui_grid_lvgl_column_ext_t *ext = &adapter->column_exts[index];
        if (ext->column_name != NULL && strcmp(ext->column_name, column_name) == 0) {
            return ext;
        }
    }

    return NULL;
}

static void ui_grid_lvgl_free_string(char **value) {
    if (value == NULL || *value == NULL) {
        return;
    }

    free(*value);
    *value = NULL;
}

static void ui_grid_lvgl_free_group_by_columns(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL || adapter->group_by_columns == NULL) {
        return;
    }

    for (int index = 0; index < adapter->group_by_count; index++) {
        free(adapter->group_by_columns[index]);
    }

    free(adapter->group_by_columns);
    adapter->group_by_columns = NULL;
    adapter->group_by_count = 0;
}

static void ui_grid_lvgl_free_column_widths(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL || adapter->column_widths == NULL) {
        return;
    }

    for (int index = 0; index < adapter->column_width_count; index++) {
        free(adapter->column_widths[index].column_name);
    }

    free(adapter->column_widths);
    adapter->column_widths = NULL;
    adapter->column_width_count = 0;
}

static void ui_grid_lvgl_free_pinned_columns(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL || adapter->pinned_columns == NULL) {
        return;
    }

    for (int index = 0; index < adapter->pinned_column_count; index++) {
        free(adapter->pinned_columns[index].column_name);
        free(adapter->pinned_columns[index].side);
    }

    free(adapter->pinned_columns);
    adapter->pinned_columns = NULL;
    adapter->pinned_column_count = 0;
}

static char *ui_grid_lvgl_strdup(const char *value) {
    size_t length;
    char *copy;

    if (value == NULL) {
        return NULL;
    }

    length = strlen(value);
    copy = (char *)malloc(length + 1);
    if (copy == NULL) {
        return NULL;
    }

    memcpy(copy, value, length + 1);
    return copy;
}

static int ui_grid_lvgl_token_span(const jsmntok_t *tokens, int index) {
    int span = 1;

    if (tokens[index].type == JSMN_ARRAY || tokens[index].type == JSMN_OBJECT) {
        int child = index + 1;
        for (int count = 0; count < tokens[index].size; count++) {
            int child_span = ui_grid_lvgl_token_span(tokens, child);
            span += child_span;
            child += child_span;
        }
    }

    return span;
}

static bool ui_grid_lvgl_token_equals(const char *json, const jsmntok_t *token, const char *value) {
    size_t token_length;
    size_t value_length;

    if (token == NULL || value == NULL || token->start < 0 || token->end < token->start) {
        return false;
    }

    token_length = (size_t)(token->end - token->start);
    value_length = strlen(value);
    return token_length == value_length && strncmp(json + token->start, value, token_length) == 0;
}

static char *ui_grid_lvgl_token_strdup(const char *json, const jsmntok_t *token) {
    size_t length;
    char *copy;

    if (token == NULL || token->start < 0 || token->end < token->start) {
        return NULL;
    }

    length = (size_t)(token->end - token->start);
    copy = (char *)malloc(length + 1);
    if (copy == NULL) {
        return NULL;
    }

    memcpy(copy, json + token->start, length);
    copy[length] = '\0';
    return copy;
}

static int ui_grid_lvgl_object_find(const char *json, const jsmntok_t *tokens, int object_index, const char *key) {
    int cursor;

    if (tokens[object_index].type != JSMN_OBJECT) {
        return -1;
    }

    cursor = object_index + 1;
    for (int pair_index = 0; pair_index < tokens[object_index].size; pair_index++) {
        int key_index = cursor;
        int value_index = key_index + 1;
        int value_span;

        if (ui_grid_lvgl_token_equals(json, &tokens[key_index], key)) {
            return value_index;
        }

        value_span = ui_grid_lvgl_token_span(tokens, value_index);
        cursor = value_index + value_span;
    }

    return -1;
}

static int ui_grid_lvgl_array_item(const jsmntok_t *tokens, int array_index, int item_index) {
    int cursor;

    if (tokens[array_index].type != JSMN_ARRAY || item_index < 0 || item_index >= tokens[array_index].size) {
        return -1;
    }

    cursor = array_index + 1;
    for (int index = 0; index < item_index; index++) {
        cursor += ui_grid_lvgl_token_span(tokens, cursor);
    }

    return cursor;
}

static char *ui_grid_lvgl_value_to_text(const char *json, const jsmntok_t *tokens, int token_index) {
    const jsmntok_t *token = &tokens[token_index];

    if (token->type == JSMN_STRING || token->type == JSMN_PRIMITIVE) {
        char *text = ui_grid_lvgl_token_strdup(json, token);
        if (text != NULL && strcmp(text, "null") == 0) {
            text[0] = '\0';
        }
        return text;
    }

    if (token->type == JSMN_OBJECT) {
        return ui_grid_lvgl_token_strdup("[object]", &(jsmntok_t){.start = 0, .end = 8, .type = JSMN_STRING});
    }

    if (token->type == JSMN_ARRAY) {
        return ui_grid_lvgl_token_strdup("[array]", &(jsmntok_t){.start = 0, .end = 7, .type = JSMN_STRING});
    }

    return NULL;
}

static bool ui_grid_lvgl_token_is_true(const char *json, const jsmntok_t *token) {
    return ui_grid_lvgl_token_equals(json, token, "true");
}

static int ui_grid_lvgl_token_to_int(const char *json, const jsmntok_t *token, int fallback) {
    char *text;
    long value;
    char *end = NULL;

    if (token == NULL) {
        return fallback;
    }

    text = ui_grid_lvgl_token_strdup(json, token);
    if (text == NULL) {
        return fallback;
    }

    value = strtol(text, &end, 10);
    if (end == NULL || *end != '\0') {
        free(text);
        return fallback;
    }

    free(text);

    return (int)value;
}

static void ui_grid_lvgl_clear_headers(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL) {
        return;
    }

    if (adapter->header_row != NULL) {
        lv_obj_clean(adapter->header_row);
    }

    if (adapter->header_refs != NULL) {
        for (int index = 0; index < adapter->header_ref_count; index++) {
            ui_grid_lvgl_free_string(&adapter->header_refs[index].column_name);
        }
        free(adapter->header_refs);
        adapter->header_refs = NULL;
    }

    adapter->header_ref_count = 0;
}

static void ui_grid_lvgl_free_active_filters(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL || adapter->active_filters == NULL) {
        return;
    }

    for (int index = 0; index < adapter->active_filter_count; index++) {
        free(adapter->active_filters[index].column_name);
        free(adapter->active_filters[index].value);
    }

    free(adapter->active_filters);
    adapter->active_filters = NULL;
    adapter->active_filter_count = 0;
}

static const char *ui_grid_lvgl_active_filter_value(
    const ui_grid_lvgl_adapter_t *adapter,
    const char *column_name
) {
    if (adapter == NULL || column_name == NULL) {
        return NULL;
    }

    for (int index = 0; index < adapter->active_filter_count; index++) {
        if (
            adapter->active_filters[index].column_name != NULL &&
            strcmp(adapter->active_filters[index].column_name, column_name) == 0
        ) {
            return adapter->active_filters[index].value;
        }
    }

    return NULL;
}

static lv_color_t ui_grid_lvgl_hex(uint32_t value) {
    return lv_color_hex(value & 0x00ffffffu);
}

static int ui_grid_lvgl_parse_column_width_value(const char *width_text, int fallback) {
    char *end = NULL;
    long value;

    if (width_text == NULL || *width_text == '\0') {
        return fallback;
    }

    value = strtol(width_text, &end, 10);
    if (end == width_text) {
        return fallback;
    }

    return value > 40 ? (int)value : fallback;
}

static const char *ui_grid_lvgl_get_pinned_side(const ui_grid_lvgl_adapter_t *adapter, const char *column_name);

/* ── per-display-row metadata + cell paint cache ──────────────────────── */

static void ui_grid_lvgl_clear_display_rows(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL || adapter->display_rows == NULL) {
        return;
    }
    for (int index = 0; index < adapter->display_row_count; index++) {
        free(adapter->display_rows[index].row_id);
        free(adapter->display_rows[index].group_key);
    }
    adapter->display_row_count = 0;
}

static void ui_grid_lvgl_reserve_display_rows(ui_grid_lvgl_adapter_t *adapter, int needed) {
    if (needed <= adapter->display_row_capacity) {
        return;
    }
    int new_capacity = adapter->display_row_capacity > 0 ? adapter->display_row_capacity : 16;
    while (new_capacity < needed) {
        new_capacity *= 2;
    }
    void *resized = realloc(adapter->display_rows, sizeof(*adapter->display_rows) * (size_t)new_capacity);
    if (resized == NULL) {
        return;
    }
    adapter->display_rows = resized;
    /* zero new region */
    memset(
        (char *)adapter->display_rows + sizeof(*adapter->display_rows) * (size_t)adapter->display_row_capacity,
        0,
        sizeof(*adapter->display_rows) * (size_t)(new_capacity - adapter->display_row_capacity)
    );
    adapter->display_row_capacity = new_capacity;
}

static void ui_grid_lvgl_reserve_cell_paints(ui_grid_lvgl_adapter_t *adapter, int rows, int cols) {
    int needed = rows * cols;
    if (needed <= 0) {
        adapter->cell_paint_rows = 0;
        adapter->cell_paint_cols = 0;
        return;
    }
    if (needed > adapter->cell_paint_capacity) {
        ui_grid_lvgl_cell_paint_t *resized =
            (ui_grid_lvgl_cell_paint_t *)realloc(adapter->cell_paints, sizeof(*adapter->cell_paints) * (size_t)needed);
        if (resized == NULL) {
            return;
        }
        adapter->cell_paints = resized;
        adapter->cell_paint_capacity = needed;
    }
    memset(adapter->cell_paints, 0, sizeof(*adapter->cell_paints) * (size_t)needed);
    adapter->cell_paint_rows = rows;
    adapter->cell_paint_cols = cols;
}

/* expanded set helpers */

static bool ui_grid_lvgl_string_set_contains(char **set, int count, const char *value) {
    if (set == NULL || value == NULL) {
        return false;
    }
    for (int index = 0; index < count; index++) {
        if (set[index] != NULL && strcmp(set[index], value) == 0) {
            return true;
        }
    }
    return false;
}

static bool ui_grid_lvgl_string_set_toggle(
    char ***set_ptr,
    int *count_ptr,
    int *capacity_ptr,
    const char *value
) {
    if (set_ptr == NULL || count_ptr == NULL || capacity_ptr == NULL || value == NULL) {
        return false;
    }
    char **set = *set_ptr;
    for (int index = 0; index < *count_ptr; index++) {
        if (set[index] != NULL && strcmp(set[index], value) == 0) {
            free(set[index]);
            set[index] = set[*count_ptr - 1];
            set[*count_ptr - 1] = NULL;
            (*count_ptr)--;
            return false; /* removed */
        }
    }
    if (*count_ptr >= *capacity_ptr) {
        int new_capacity = *capacity_ptr > 0 ? *capacity_ptr * 2 : 8;
        char **resized = (char **)realloc(set, sizeof(*set) * (size_t)new_capacity);
        if (resized == NULL) {
            return false;
        }
        *set_ptr = resized;
        set = resized;
        *capacity_ptr = new_capacity;
    }
    set[*count_ptr] = ui_grid_lvgl_strdup(value);
    if (set[*count_ptr] == NULL) {
        return false;
    }
    (*count_ptr)++;
    return true; /* added */
}

static char *ui_grid_lvgl_build_string_set_command(
    const char *kind,
    const char *map_key,
    char **set,
    int count
) {
    /* Builds: {"kind":"<kind>","<map_key>":{"id1":true,"id2":true}} */
    size_t capacity = 256;
    for (int index = 0; index < count; index++) {
        if (set[index] != NULL) {
            capacity += strlen(set[index]) + 16;
        }
    }
    char *json = (char *)malloc(capacity);
    if (json == NULL) {
        return NULL;
    }
    int cursor = snprintf(json, capacity, "{\"kind\":\"%s\",\"%s\":{", kind, map_key);
    for (int index = 0; index < count; index++) {
        if (set[index] == NULL) {
            continue;
        }
        cursor += snprintf(json + cursor, capacity - (size_t)cursor, "%s\"%s\":true", index == 0 ? "" : ",", set[index]);
    }
    snprintf(json + cursor, capacity - (size_t)cursor, "}}");
    return json;
}

/* lookup_value adapter for cell paint context: returns NULL if column missing */
typedef struct ui_grid_lvgl_lookup_state {
    const char *json;
    const jsmntok_t *tokens;
    int entity_index;
    char scratch[128];
} ui_grid_lvgl_lookup_state_t;

static const char *ui_grid_lvgl_paint_lookup(
    const struct ui_grid_lvgl_cell_paint_context *ctx,
    const char *column_name
) {
    if (ctx == NULL || ctx->lookup_state == NULL || column_name == NULL) {
        return NULL;
    }
    ui_grid_lvgl_lookup_state_t *state = (ui_grid_lvgl_lookup_state_t *)ctx->lookup_state;
    int value_index = ui_grid_lvgl_object_find(state->json, state->tokens, state->entity_index, column_name);
    if (value_index < 0) {
        return NULL;
    }
    int len = state->tokens[value_index].end - state->tokens[value_index].start;
    if (len < 0 || len >= (int)sizeof(state->scratch)) {
        len = (int)sizeof(state->scratch) - 1;
    }
    memcpy(state->scratch, state->json + state->tokens[value_index].start, (size_t)len);
    state->scratch[len] = '\0';
    return state->scratch;
}

static bool ui_grid_lvgl_column_at_index_is_pinned(
    const ui_grid_lvgl_adapter_t *adapter,
    int column_index
) {
    if (adapter == NULL || column_index < 0 || column_index >= adapter->header_ref_count) {
        return false;
    }
    return ui_grid_lvgl_get_pinned_side(adapter, adapter->header_refs[column_index].column_name) != NULL;
}

static bool ui_grid_lvgl_column_at_index_is_sorted(
    const ui_grid_lvgl_adapter_t *adapter,
    int column_index
) {
    if (adapter == NULL || column_index < 0 || column_index >= adapter->header_ref_count
        || adapter->current_sort_column == NULL
        || adapter->current_sort_direction == UI_GRID_LVGL_SORT_NONE) {
        return false;
    }
    return strcmp(adapter->current_sort_column, adapter->header_refs[column_index].column_name) == 0;
}

static void ui_grid_lvgl_table_draw_event(lv_event_t *event) {
    ui_grid_lvgl_adapter_t *adapter = (ui_grid_lvgl_adapter_t *)lv_event_get_user_data(event);
    lv_draw_task_t *draw_task = lv_event_get_draw_task(event);
    lv_draw_dsc_base_t *base_dsc;
    lv_draw_fill_dsc_t *fill_draw_dsc;
    lv_draw_label_dsc_t *label_draw_dsc;
    int row;
    int col;
    bool pinned;
    bool sorted;

    if (adapter == NULL || draw_task == NULL) {
        return;
    }

    base_dsc = (lv_draw_dsc_base_t *)lv_draw_task_get_draw_dsc(draw_task);
    if (base_dsc == NULL || base_dsc->part != LV_PART_ITEMS) {
        return;
    }

    row = (int)base_dsc->id1;
    col = (int)base_dsc->id2;
    pinned = ui_grid_lvgl_column_at_index_is_pinned(adapter, col);
    sorted = ui_grid_lvgl_column_at_index_is_sorted(adapter, col);

    /* Per-cell paint override from column-ext painters */
    const ui_grid_lvgl_cell_paint_t *paint = NULL;
    if (adapter->cell_paints != NULL
        && row >= 0 && row < adapter->cell_paint_rows
        && col >= 0 && col < adapter->cell_paint_cols) {
        paint = &adapter->cell_paints[row * adapter->cell_paint_cols + col];
    }

    fill_draw_dsc = lv_draw_task_get_fill_dsc(draw_task);
    if (fill_draw_dsc != NULL) {
        if (paint != NULL && paint->override_bg) {
            fill_draw_dsc->color = ui_grid_lvgl_hex(paint->bg_color);
            fill_draw_dsc->opa = paint->bg_opa > 0 ? paint->bg_opa : LV_OPA_COVER;
        } else {
            uint32_t color;
            if (pinned) {
                color = adapter->theme.pinned_row_background;
            } else if (sorted) {
                color = adapter->theme.control_hover_background;
            } else if (row % 2 == 0) {
                color = adapter->theme.row_even;
            } else {
                color = adapter->theme.row_odd;
            }
            fill_draw_dsc->color = ui_grid_lvgl_hex(color);
            fill_draw_dsc->opa = LV_OPA_COVER;
        }
    }

    label_draw_dsc = lv_draw_task_get_label_dsc(draw_task);
    if (label_draw_dsc != NULL) {
        if (paint != NULL && paint->override_text) {
            label_draw_dsc->color = ui_grid_lvgl_hex(paint->text_color);
        } else {
            label_draw_dsc->color = ui_grid_lvgl_hex(adapter->theme.cell_color);
        }
        label_draw_dsc->align = LV_TEXT_ALIGN_LEFT;
    }
}

static int ui_grid_lvgl_find_saved_column_width(const ui_grid_lvgl_adapter_t *adapter, const char *column_name) {
    if (adapter == NULL || column_name == NULL) {
        return 0;
    }

    for (int index = 0; index < adapter->column_width_count; index++) {
        if (strcmp(adapter->column_widths[index].column_name, column_name) == 0) {
            return adapter->column_widths[index].width;
        }
    }

    return 0;
}

static bool ui_grid_lvgl_set_saved_column_width(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    int width
) {
    ui_grid_lvgl_column_width_t *resized;

    if (adapter == NULL || column_name == NULL || width <= 0) {
        return false;
    }

    for (int index = 0; index < adapter->column_width_count; index++) {
        if (strcmp(adapter->column_widths[index].column_name, column_name) == 0) {
            adapter->column_widths[index].width = width;
            return true;
        }
    }

    resized = (ui_grid_lvgl_column_width_t *)realloc(
        adapter->column_widths,
        sizeof(*adapter->column_widths) * (size_t)(adapter->column_width_count + 1)
    );
    if (resized == NULL) {
        return false;
    }

    adapter->column_widths = resized;
    adapter->column_widths[adapter->column_width_count].column_name = ui_grid_lvgl_strdup(column_name);
    if (adapter->column_widths[adapter->column_width_count].column_name == NULL) {
        return false;
    }

    adapter->column_widths[adapter->column_width_count].width = width;
    adapter->column_width_count++;
    return true;
}

static void ui_grid_lvgl_apply_theme(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL) {
        return;
    }

    lv_obj_set_style_bg_color(adapter->root, ui_grid_lvgl_hex(adapter->theme.surface), 0);
    lv_obj_set_style_bg_opa(adapter->root, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(adapter->root, ui_grid_lvgl_hex(adapter->theme.border_color), 0);
    lv_obj_set_style_border_width(adapter->root, 1, 0);
    lv_obj_set_style_radius(adapter->root, (int32_t)adapter->theme.radius, 0);
    lv_obj_set_style_text_color(adapter->root, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);

    lv_obj_set_style_bg_color(adapter->header_row, ui_grid_lvgl_hex(adapter->theme.header_background), 0);
    lv_obj_set_style_bg_opa(adapter->header_row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(adapter->header_row, ui_grid_lvgl_hex(adapter->theme.border_color), 0);
    lv_obj_set_style_border_width(adapter->header_row, 0, 0);
    lv_obj_set_style_border_side(adapter->header_row, LV_BORDER_SIDE_BOTTOM, 0);
    lv_obj_set_style_text_color(adapter->header_row, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);

    lv_obj_set_style_bg_color(adapter->table, ui_grid_lvgl_hex(adapter->theme.surface), 0);
    lv_obj_set_style_bg_opa(adapter->table, LV_OPA_COVER, 0);
    lv_obj_set_style_text_color(adapter->table, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);
    lv_obj_set_style_text_color(adapter->table, ui_grid_lvgl_hex(adapter->theme.cell_color), LV_PART_ITEMS);
    lv_obj_set_style_border_color(adapter->table, ui_grid_lvgl_hex(adapter->theme.border_color), 0);
    lv_obj_set_style_border_width(adapter->table, 0, 0);

    lv_obj_set_style_text_color(adapter->footer_label, ui_grid_lvgl_hex(adapter->theme.muted_color), 0);
    lv_obj_set_style_bg_color(adapter->footer_label, ui_grid_lvgl_hex(adapter->theme.surface), 0);
    lv_obj_set_style_bg_opa(adapter->footer_label, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(adapter->footer_label, 6, 0);
}

static ui_grid_lvgl_sort_direction_t ui_grid_lvgl_parse_sort_direction_token(
    const char *json,
    const jsmntok_t *token
) {
    if (token == NULL) {
        return UI_GRID_LVGL_SORT_NONE;
    }
    if (ui_grid_lvgl_token_equals(json, token, "asc")) {
        return UI_GRID_LVGL_SORT_ASC;
    }
    if (ui_grid_lvgl_token_equals(json, token, "desc")) {
        return UI_GRID_LVGL_SORT_DESC;
    }
    return UI_GRID_LVGL_SORT_NONE;
}

static bool ui_grid_lvgl_column_is_sorted(
    const ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    ui_grid_lvgl_sort_direction_t *direction_out
) {
    if (
        adapter->current_sort_column != NULL &&
        strcmp(adapter->current_sort_column, column_name) == 0 &&
        adapter->current_sort_direction != UI_GRID_LVGL_SORT_NONE
    ) {
        if (direction_out != NULL) {
            *direction_out = adapter->current_sort_direction;
        }
        return true;
    }

    if (direction_out != NULL) {
        *direction_out = UI_GRID_LVGL_SORT_NONE;
    }

    return false;
}

static void ui_grid_lvgl_update_sort_state(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int payload_index
) {
    int sort_state_index;
    int column_index;
    int direction_index;

    ui_grid_lvgl_free_string(&adapter->current_sort_column);
    adapter->current_sort_direction = UI_GRID_LVGL_SORT_NONE;

    if (payload_index < 0) {
        return;
    }

    sort_state_index = ui_grid_lvgl_object_find(json, tokens, payload_index, "sortState");
    if (sort_state_index < 0 || tokens[sort_state_index].type != JSMN_OBJECT) {
        return;
    }

    column_index = ui_grid_lvgl_object_find(json, tokens, sort_state_index, "columnName");
    direction_index = ui_grid_lvgl_object_find(json, tokens, sort_state_index, "direction");

    if (column_index >= 0 && !ui_grid_lvgl_token_equals(json, &tokens[column_index], "null")) {
        adapter->current_sort_column = ui_grid_lvgl_token_strdup(json, &tokens[column_index]);
    }
    if (direction_index >= 0) {
        adapter->current_sort_direction = ui_grid_lvgl_parse_sort_direction_token(json, &tokens[direction_index]);
    }
}

static void ui_grid_lvgl_update_grouping_state(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int payload_index
) {
    int grouping_index;

    ui_grid_lvgl_free_group_by_columns(adapter);
    if (adapter == NULL || payload_index < 0) {
        return;
    }

    grouping_index = ui_grid_lvgl_object_find(json, tokens, payload_index, "groupByColumns");
    if (grouping_index < 0 || tokens[grouping_index].type != JSMN_ARRAY || tokens[grouping_index].size <= 0) {
        return;
    }

    adapter->group_by_columns = (char **)calloc((size_t)tokens[grouping_index].size, sizeof(char *));
    if (adapter->group_by_columns == NULL) {
        return;
    }

    for (int index = 0; index < tokens[grouping_index].size; index++) {
        int item_index = ui_grid_lvgl_array_item(tokens, grouping_index, index);
        char *value = item_index >= 0 ? ui_grid_lvgl_token_strdup(json, &tokens[item_index]) : NULL;
        if (value == NULL) {
            continue;
        }

        adapter->group_by_columns[adapter->group_by_count++] = value;
    }
}

static void ui_grid_lvgl_update_pinning_state(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int payload_index
) {
    int pinned_index;
    int cursor;

    ui_grid_lvgl_free_pinned_columns(adapter);
    if (adapter == NULL || payload_index < 0) {
        return;
    }

    pinned_index = ui_grid_lvgl_object_find(json, tokens, payload_index, "pinnedColumns");
    if (pinned_index < 0 || tokens[pinned_index].type != JSMN_OBJECT || tokens[pinned_index].size <= 0) {
        return;
    }

    adapter->pinned_columns = (ui_grid_lvgl_pinned_column_t *)calloc(
        (size_t)tokens[pinned_index].size,
        sizeof(*adapter->pinned_columns)
    );
    if (adapter->pinned_columns == NULL) {
        return;
    }

    cursor = pinned_index + 1;
    for (int pair_index = 0; pair_index < tokens[pinned_index].size; pair_index++) {
        int key_index = cursor;
        int value_index = key_index + 1;
        int value_span = ui_grid_lvgl_token_span(tokens, value_index);
        char *column_name = ui_grid_lvgl_token_strdup(json, &tokens[key_index]);
        char *side = ui_grid_lvgl_token_strdup(json, &tokens[value_index]);

        cursor = value_index + value_span;
        if (column_name == NULL || side == NULL) {
            free(column_name);
            free(side);
            continue;
        }

        adapter->pinned_columns[adapter->pinned_column_count].column_name = column_name;
        adapter->pinned_columns[adapter->pinned_column_count].side = side;
        adapter->pinned_column_count++;
    }
}

static void ui_grid_lvgl_update_filter_state(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int payload_index
) {
    int options_index;
    int enable_filtering_index;
    int active_filters_index;
    int cursor;

    if (adapter == NULL) {
        return;
    }

    ui_grid_lvgl_free_active_filters(adapter);
    adapter->enable_filtering = false;

    if (payload_index < 0) {
        return;
    }

    options_index = ui_grid_lvgl_object_find(json, tokens, payload_index, "options");
    enable_filtering_index = options_index >= 0
        ? ui_grid_lvgl_object_find(json, tokens, options_index, "enableFiltering")
        : -1;
    if (enable_filtering_index >= 0) {
        adapter->enable_filtering = ui_grid_lvgl_token_is_true(json, &tokens[enable_filtering_index]);
    }

    active_filters_index = ui_grid_lvgl_object_find(json, tokens, payload_index, "activeFilters");
    if (
        active_filters_index < 0 ||
        tokens[active_filters_index].type != JSMN_OBJECT ||
        tokens[active_filters_index].size <= 0
    ) {
        return;
    }

    adapter->active_filters = (ui_grid_lvgl_active_filter_t *)calloc(
        (size_t)tokens[active_filters_index].size,
        sizeof(*adapter->active_filters)
    );
    if (adapter->active_filters == NULL) {
        return;
    }

    cursor = active_filters_index + 1;
    for (int pair_index = 0; pair_index < tokens[active_filters_index].size; pair_index++) {
        int key_index = cursor;
        int value_index = key_index + 1;
        int value_span = ui_grid_lvgl_token_span(tokens, value_index);
        char *column_name = ui_grid_lvgl_token_strdup(json, &tokens[key_index]);
        char *value = ui_grid_lvgl_token_strdup(json, &tokens[value_index]);

        cursor = value_index + value_span;
        if (column_name == NULL || value == NULL) {
            free(column_name);
            free(value);
            continue;
        }

        adapter->active_filters[adapter->active_filter_count].column_name = column_name;
        adapter->active_filters[adapter->active_filter_count].value = value;
        adapter->active_filter_count++;
    }
}

static void ui_grid_lvgl_table_scroll_event(lv_event_t *event) {
    ui_grid_lvgl_adapter_t *adapter = (ui_grid_lvgl_adapter_t *)lv_event_get_user_data(event);

    if (adapter == NULL || adapter->header_row == NULL || adapter->table == NULL) {
        return;
    }

    int32_t scroll_x = lv_obj_get_scroll_x(adapter->table);
    lv_obj_set_pos(adapter->header_row, -scroll_x, 0);
}

static void ui_grid_lvgl_table_clicked_event(lv_event_t *event) {
    ui_grid_lvgl_adapter_t *adapter = (ui_grid_lvgl_adapter_t *)lv_event_get_user_data(event);
    if (adapter == NULL || adapter->table == NULL) {
        return;
    }
    uint32_t row;
    uint32_t col;
    lv_table_get_selected_cell(adapter->table, &row, &col);
    if (row == LV_TABLE_CELL_NONE || (int)row >= adapter->display_row_count) {
        return;
    }
    /* Tree expand toggles only fire when user taps the first column. */
    if (col != 0) {
        return;
    }
    int kind = adapter->display_rows[row].kind;
    const char *row_id = adapter->display_rows[row].row_id;
    if (kind == 3 && row_id != NULL && adapter->display_rows[row].has_children) {
        ui_grid_lvgl_string_set_toggle(
            &adapter->expanded_tree_ids,
            &adapter->expanded_tree_count,
            &adapter->expanded_tree_capacity,
            row_id
        );
        char *cmd = ui_grid_lvgl_build_string_set_command(
            "setExpandedTreeRows",
            "expandedTreeRows",
            adapter->expanded_tree_ids,
            adapter->expanded_tree_count
        );
        if (cmd != NULL) {
            ui_grid_lvgl_apply_command_json(adapter, cmd);
            free(cmd);
        }
        return;
    }
    if (kind == 2 && row_id != NULL) {
        ui_grid_lvgl_string_set_toggle(
            &adapter->expanded_row_ids,
            &adapter->expanded_row_count,
            &adapter->expanded_row_capacity,
            row_id
        );
        char *cmd = ui_grid_lvgl_build_string_set_command(
            "setExpandedRows",
            "expandedRows",
            adapter->expanded_row_ids,
            adapter->expanded_row_count
        );
        if (cmd != NULL) {
            ui_grid_lvgl_apply_command_json(adapter, cmd);
            free(cmd);
        }
        return;
    }
}

static bool ui_grid_lvgl_column_is_grouped(const ui_grid_lvgl_adapter_t *adapter, const char *column_name) {
    if (adapter == NULL || column_name == NULL) {
        return false;
    }

    for (int index = 0; index < adapter->group_by_count; index++) {
        if (strcmp(adapter->group_by_columns[index], column_name) == 0) {
            return true;
        }
    }

    return false;
}

static bool ui_grid_lvgl_point_inside(const lv_area_t *area, const lv_point_t *point) {
    return point->x >= area->x1 && point->x <= area->x2 && point->y >= area->y1 && point->y <= area->y2;
}

static const char *ui_grid_lvgl_find_header_target(ui_grid_lvgl_adapter_t *adapter, const lv_point_t *point) {
    lv_area_t area;

    for (int index = 0; index < adapter->header_ref_count; index++) {
        lv_obj_get_coords(adapter->header_refs[index].container, &area);
        if (ui_grid_lvgl_point_inside(&area, point)) {
            return adapter->header_refs[index].column_name;
        }
    }

    return NULL;
}

static ui_grid_lvgl_header_ref_t *ui_grid_lvgl_find_header_ref(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name
) {
    if (adapter == NULL || column_name == NULL) {
        return NULL;
    }

    for (int index = 0; index < adapter->header_ref_count; index++) {
        if (strcmp(adapter->header_refs[index].column_name, column_name) == 0) {
            return &adapter->header_refs[index];
        }
    }

    return NULL;
}

static void ui_grid_lvgl_apply_column_width(
    ui_grid_lvgl_adapter_t *adapter,
    ui_grid_lvgl_header_ref_t *ref,
    int width
) {
    int clamped_width = width < 88 ? 88 : width;

    if (adapter == NULL || ref == NULL) {
        return;
    }

    ref->width = clamped_width;
    lv_obj_set_width(ref->container, clamped_width);
    if (ref->drag_button != NULL) {
        lv_obj_set_width(ref->drag_button, clamped_width);
    }
    if (ref->filter_input != NULL) {
        lv_obj_set_width(ref->filter_input, clamped_width);
    }

    for (int index = 0; index < adapter->header_ref_count; index++) {
        if (&adapter->header_refs[index] == ref) {
            lv_table_set_column_width(adapter->table, (uint32_t)index, clamped_width);
            break;
        }
    }
}

static bool ui_grid_lvgl_toggle_grouping(ui_grid_lvgl_adapter_t *adapter, const char *column_name) {
    bool is_grouped;
    size_t capacity;
    char *command;
    int cursor = 0;
    bool success;

    if (adapter == NULL || column_name == NULL) {
        return false;
    }

    is_grouped = ui_grid_lvgl_column_is_grouped(adapter, column_name);
    capacity = 128 + (size_t)(adapter->group_by_count + 1) * 64;
    command = (char *)malloc(capacity);
    if (command == NULL) {
        return false;
    }

    cursor += snprintf(command + cursor, capacity - (size_t)cursor, "{\"kind\":\"setGrouping\",\"groupBy\":[");
    for (int index = 0; index < adapter->group_by_count; index++) {
        if (strcmp(adapter->group_by_columns[index], column_name) == 0) {
            continue;
        }

        cursor += snprintf(
            command + cursor,
            capacity - (size_t)cursor,
            "%s\"%s\"",
            cursor > 33 ? "," : "",
            adapter->group_by_columns[index]
        );
    }

    if (!is_grouped) {
        cursor += snprintf(
            command + cursor,
            capacity - (size_t)cursor,
            "%s\"%s\"",
            cursor > 33 ? "," : "",
            column_name
        );
    }

    snprintf(command + cursor, capacity - (size_t)cursor, "]}");
    success = ui_grid_lvgl_apply_command_json(adapter, command);
    free(command);
    return success;
}

static bool ui_grid_lvgl_header_in_group_zone(const ui_grid_lvgl_header_ref_t *ref, const lv_point_t *point) {
    lv_area_t area;
    int local_x;

    if (ref == NULL || ref->container == NULL || point == NULL) {
        return false;
    }

    lv_obj_get_coords(ref->container, &area);
    local_x = point->x - area.x1;
    /* Group rune sits ~middle of the controls block (~width-50..width-30) */
    return local_x >= ref->width - 56 && local_x < ref->width - 30;
}

static bool ui_grid_lvgl_header_in_resize_zone(const ui_grid_lvgl_header_ref_t *ref, const lv_point_t *point) {
    lv_area_t area;
    int local_x;

    if (ref == NULL || ref->container == NULL || point == NULL) {
        return false;
    }

    lv_obj_get_coords(ref->container, &area);
    local_x = point->x - area.x1;
    return local_x >= ref->width - 10;
}

static const char *ui_grid_lvgl_group_rune(bool is_grouped) {
    return is_grouped ? LV_SYMBOL_MINUS : LV_SYMBOL_PLUS;
}

static const char *ui_grid_lvgl_pin_rune(const char *side) {
    if (side != NULL && strcmp(side, "left") == 0) {
        return LV_SYMBOL_LEFT;
    }
    if (side != NULL && strcmp(side, "right") == 0) {
        return LV_SYMBOL_RIGHT;
    }
    return NULL;
}

static const char *ui_grid_lvgl_sort_rune(ui_grid_lvgl_sort_direction_t direction) {
    switch (direction) {
        case UI_GRID_LVGL_SORT_ASC:
            return LV_SYMBOL_UP;
        case UI_GRID_LVGL_SORT_DESC:
            return LV_SYMBOL_DOWN;
        case UI_GRID_LVGL_SORT_NONE:
        default:
            return LV_SYMBOL_LIST;
    }
}

static const char *ui_grid_lvgl_get_pinned_side(const ui_grid_lvgl_adapter_t *adapter, const char *column_name) {
    if (adapter == NULL || column_name == NULL) {
        return NULL;
    }

    for (int index = 0; index < adapter->pinned_column_count; index++) {
        if (strcmp(adapter->pinned_columns[index].column_name, column_name) == 0) {
            return adapter->pinned_columns[index].side;
        }
    }

    return NULL;
}

static char *ui_grid_lvgl_build_column_order_json(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    const char *target_column_name
) {
    int source_index = -1;
    int target_index = -1;
    int insert_index;
    int cursor = 0;
    size_t capacity = 256 + (size_t)adapter->header_ref_count * 64;
    char *json = (char *)malloc(capacity);

    if (json == NULL) {
        return NULL;
    }

    for (int index = 0; index < adapter->header_ref_count; index++) {
        if (strcmp(adapter->header_refs[index].column_name, column_name) == 0) {
            source_index = index;
        }
        if (strcmp(adapter->header_refs[index].column_name, target_column_name) == 0) {
            target_index = index;
        }
    }

    if (source_index < 0 || target_index < 0) {
        free(json);
        return NULL;
    }

    cursor += snprintf(json + cursor, capacity - (size_t)cursor, "{\"kind\":\"setColumnOrder\",\"columnOrder\":[");
    insert_index = target_index;

    for (int index = 0, output_index = 0; index < adapter->header_ref_count; index++) {
        const char *name;

        if (index == source_index) {
            continue;
        }

        if (output_index == insert_index) {
            cursor += snprintf(json + cursor, capacity - (size_t)cursor, "%s\"%s\"", cursor > 39 ? "," : "", column_name);
            output_index++;
        }

        name = adapter->header_refs[index].column_name;
        cursor += snprintf(json + cursor, capacity - (size_t)cursor, "%s\"%s\"", cursor > 39 ? "," : "", name);
        output_index++;
    }

    if (source_index > target_index || target_index == adapter->header_ref_count - 1) {
        bool already_emitted = strstr(json, column_name) != NULL;
        if (!already_emitted) {
            cursor += snprintf(json + cursor, capacity - (size_t)cursor, "%s\"%s\"", cursor > 39 ? "," : "", column_name);
        }
    }

    snprintf(json + cursor, capacity - (size_t)cursor, "]}");
    return json;
}

static void ui_grid_lvgl_header_drag_event(lv_event_t *event) {
    lv_event_code_t code = lv_event_get_code(event);
    ui_grid_lvgl_header_ref_t *ref = (ui_grid_lvgl_header_ref_t *)lv_event_get_user_data(event);
    ui_grid_lvgl_adapter_t *adapter;
    lv_indev_t *indev;
    lv_point_t point;

    if (ref == NULL || ref->adapter == NULL) {
        return;
    }

    adapter = ref->adapter;
    indev = lv_indev_active();
    if (indev != NULL) {
        lv_indev_get_point(indev, &point);
    } else {
        point.x = 0;
        point.y = 0;
    }

    if (code == LV_EVENT_PRESSED) {
        if (adapter->enable_column_resizing && ui_grid_lvgl_header_in_resize_zone(ref, &point)) {
            ui_grid_lvgl_free_string(&adapter->resize_column);
            adapter->resize_column = ui_grid_lvgl_strdup(ref->column_name);
            adapter->resize_start = point;
            adapter->resize_start_width = ref->width;
            return;
        }

        if (ui_grid_lvgl_header_in_group_zone(ref, &point)) {
            return;
        }

        ui_grid_lvgl_free_string(&adapter->drag_source_column);
        adapter->drag_source_column = ui_grid_lvgl_strdup(ref->column_name);
        adapter->drag_active = false;
        adapter->drag_start = point;
        return;
    }

    if (code == LV_EVENT_PRESSING) {
        if (adapter->resize_column != NULL && strcmp(adapter->resize_column, ref->column_name) == 0) {
            int next_width = adapter->resize_start_width + (point.x - adapter->resize_start.x);
            ui_grid_lvgl_set_saved_column_width(adapter, ref->column_name, next_width);
            ui_grid_lvgl_apply_column_width(adapter, ref, next_width);
            return;
        }

        if (
            adapter->drag_source_column != NULL &&
            (abs(point.x - adapter->drag_start.x) > 8 || abs(point.y - adapter->drag_start.y) > 8)
        ) {
            adapter->drag_active = true;
        }
        return;
    }

    if (code == LV_EVENT_RELEASED) {
        if (adapter->resize_column != NULL && strcmp(adapter->resize_column, ref->column_name) == 0) {
            ui_grid_lvgl_free_string(&adapter->resize_column);
            return;
        }

        if (adapter->drag_active && adapter->drag_source_column != NULL) {
            const char *target_column = ui_grid_lvgl_find_header_target(adapter, &point);
            if (target_column != NULL && strcmp(target_column, adapter->drag_source_column) != 0) {
                ui_grid_lvgl_move_column_before(adapter, adapter->drag_source_column, target_column);
            }
        } else if (ui_grid_lvgl_header_in_group_zone(ref, &point)) {
            ui_grid_lvgl_toggle_grouping(adapter, ref->column_name);
        } else {
            /* default click → cycle sort, matching egui parity */
            ui_grid_lvgl_sort_direction_t next_direction = UI_GRID_LVGL_SORT_ASC;
            if (
                adapter->current_sort_column != NULL &&
                strcmp(adapter->current_sort_column, ref->column_name) == 0
            ) {
                next_direction = adapter->current_sort_direction == UI_GRID_LVGL_SORT_ASC
                    ? UI_GRID_LVGL_SORT_DESC
                    : adapter->current_sort_direction == UI_GRID_LVGL_SORT_DESC
                        ? UI_GRID_LVGL_SORT_NONE
                        : UI_GRID_LVGL_SORT_ASC;
            }
            ui_grid_lvgl_sort_by(adapter, ref->column_name, next_direction);
        }

        ui_grid_lvgl_free_string(&adapter->drag_source_column);
        adapter->drag_active = false;
        return;
    }

    if (code == LV_EVENT_PRESS_LOST) {
        ui_grid_lvgl_free_string(&adapter->resize_column);
        ui_grid_lvgl_free_string(&adapter->drag_source_column);
        adapter->drag_active = false;
    }
}

static void ui_grid_lvgl_filter_apply_async(void *arg) {
    char *command = (char *)arg;
    /* The first 8 bytes of the buffer are the adapter pointer; the rest is the JSON. */
    ui_grid_lvgl_adapter_t *adapter = NULL;
    memcpy(&adapter, command, sizeof(adapter));
    const char *json = command + sizeof(adapter);
    if (adapter != NULL) {
        ui_grid_lvgl_apply_command_json(adapter, json);
    }
    free(command);
}

static void ui_grid_lvgl_filter_event(lv_event_t *event) {
    lv_event_code_t code = lv_event_get_code(event);
    ui_grid_lvgl_header_ref_t *ref = (ui_grid_lvgl_header_ref_t *)lv_event_get_user_data(event);
    const char *current_filter;
    const char *value;

    if (
        ref == NULL ||
        ref->adapter == NULL ||
        ref->filter_input == NULL ||
        ref->adapter->suppress_filter_events ||
        (code != LV_EVENT_READY && code != LV_EVENT_VALUE_CHANGED)
    ) {
        return;
    }

    value = lv_textarea_get_text(ref->filter_input);
    current_filter = ui_grid_lvgl_active_filter_value(ref->adapter, ref->column_name);
    if ((current_filter == NULL || *current_filter == '\0') && (value == NULL || *value == '\0')) {
        return;
    }
    if (current_filter != NULL && value != NULL && strcmp(current_filter, value) == 0) {
        return;
    }

    /* Remember which column we were typing in so we can restore focus and
     * cursor position after the inevitable header rebuild. */
    free(ref->adapter->pending_filter_focus_column);
    ref->adapter->pending_filter_focus_column = ui_grid_lvgl_strdup(ref->column_name);
    ref->adapter->pending_filter_focus_pos = lv_textarea_get_cursor_pos(ref->filter_input);

    /* The apply path rebuilds headers, which would delete this textarea while
     * we're still inside its event callback. Defer the work to the next idle
     * tick so the current event safely unwinds first. */
    const char *safe_value = value != NULL ? value : "";
    size_t json_len = strlen(ref->column_name) + strlen(safe_value) + 96;
    size_t total = sizeof(ui_grid_lvgl_adapter_t *) + json_len;
    char *buffer = (char *)malloc(total);
    if (buffer == NULL) {
        return;
    }
    ui_grid_lvgl_adapter_t *adapter_ptr = ref->adapter;
    memcpy(buffer, &adapter_ptr, sizeof(adapter_ptr));
    snprintf(
        buffer + sizeof(adapter_ptr),
        json_len,
        "{\"kind\":\"setFilter\",\"columnName\":\"%s\",\"value\":\"%s\"}",
        ref->column_name,
        safe_value
    );
    lv_async_call(ui_grid_lvgl_filter_apply_async, buffer);
}

static void ui_grid_lvgl_render_headers(
    ui_grid_lvgl_adapter_t *adapter,
    const ui_grid_lvgl_column_t *columns,
    int column_count
) {
    adapter->suppress_filter_events = true;
    ui_grid_lvgl_clear_headers(adapter);
    adapter->header_refs = (ui_grid_lvgl_header_ref_t *)calloc((size_t)column_count, sizeof(*adapter->header_refs));
    if (adapter->header_refs == NULL) {
        adapter->suppress_filter_events = false;
        return;
    }

    adapter->header_ref_count = column_count;
    int header_height = adapter->enable_filtering ? 66 : 34;
    if (adapter->header_clip != NULL) {
        lv_obj_set_height(adapter->header_clip, header_height);
    }
    lv_obj_set_height(adapter->header_row, header_height);

    for (int index = 0; index < column_count; index++) {
        lv_obj_t *column_container = lv_obj_create(adapter->header_row);
        lv_obj_t *button = lv_button_create(column_container);
        lv_obj_t *title_label = lv_label_create(button);
        lv_obj_t *controls_label = lv_label_create(button);
        ui_grid_lvgl_sort_direction_t direction = UI_GRID_LVGL_SORT_NONE;
        bool is_grouped = ui_grid_lvgl_column_is_grouped(adapter, columns[index].name);
        char title_text[160];
        char controls_text[48];
        const char *pin_side = ui_grid_lvgl_get_pinned_side(adapter, columns[index].name);
        const char *active_filter = ui_grid_lvgl_active_filter_value(adapter, columns[index].name);
        int resolved_width;
        const ui_grid_lvgl_column_ext_t *ext = ui_grid_lvgl_find_column_ext(adapter, columns[index].name);

        lv_obj_set_size(column_container, 176, adapter->enable_filtering ? 66 : 34);
        lv_obj_set_layout(column_container, LV_LAYOUT_FLEX);
        lv_obj_set_flex_flow(column_container, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_style_pad_all(column_container, 0, 0);
        lv_obj_set_style_pad_gap(column_container, 0, 0);
        lv_obj_set_style_bg_opa(column_container, LV_OPA_TRANSP, 0);
        lv_obj_set_style_border_width(column_container, 0, 0);
        lv_obj_remove_flag(column_container, LV_OBJ_FLAG_SCROLLABLE);

        adapter->header_refs[index].adapter = adapter;
        adapter->header_refs[index].container = column_container;
        adapter->header_refs[index].drag_button = button;
        adapter->header_refs[index].filter_input = NULL;
        adapter->header_refs[index].sort_button = NULL;
        adapter->header_refs[index].group_button = NULL;
        adapter->header_refs[index].resize_handle = NULL;
        adapter->header_refs[index].column_name = ui_grid_lvgl_strdup(columns[index].name);
        adapter->header_refs[index].is_grouped = is_grouped;

        ui_grid_lvgl_column_is_sorted(adapter, columns[index].name, &direction);
        resolved_width = ui_grid_lvgl_find_saved_column_width(adapter, columns[index].name);
        if (resolved_width <= 0) {
            resolved_width = ui_grid_lvgl_parse_column_width_value(columns[index].width_text, 176);
            ui_grid_lvgl_set_saved_column_width(adapter, columns[index].name, resolved_width);
        }
        adapter->header_refs[index].width = resolved_width;

        if (ext != NULL && ext->header_label_renderer != NULL) {
            ui_grid_lvgl_header_controls_context_t context = {
                .column_name = columns[index].name,
                .theme = &adapter->theme,
                .is_grouped = is_grouped,
                .sort_direction = (int)direction,
                .pin_direction = "center",
                .can_sort = true,
                .can_group = true,
                .can_pin = true,
                .can_move = true,
            };
            if (!ext->header_label_renderer(&context, title_text, sizeof(title_text), ext->user_data)) {
                snprintf(title_text, sizeof(title_text), "%s", columns[index].label);
            }
        } else {
            snprintf(title_text, sizeof(title_text), "%s", columns[index].label);
        }

        {
            const char *pin_glyph = ui_grid_lvgl_pin_rune(pin_side);
            snprintf(
                controls_text,
                sizeof(controls_text),
                "%s%s  %s  %s",
                pin_glyph != NULL ? pin_glyph : "",
                pin_glyph != NULL ? " " : "",
                ui_grid_lvgl_group_rune(is_grouped),
                ui_grid_lvgl_sort_rune(direction)
            );
        }

        lv_obj_set_size(button, resolved_width, 32);
        lv_obj_remove_flag(button, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_pad_all(button, 0, 0);
        lv_obj_set_style_radius(button, 0, 0);
        lv_obj_set_style_text_align(button, LV_TEXT_ALIGN_LEFT, 0);
        lv_obj_set_style_bg_color(
            button,
            pin_side != NULL
                ? ui_grid_lvgl_hex(adapter->theme.pinned_header_background)
                : (direction == UI_GRID_LVGL_SORT_NONE
                    ? ui_grid_lvgl_hex(adapter->theme.header_background)
                    : ui_grid_lvgl_hex(adapter->theme.control_active_background)),
            0
        );
        lv_obj_set_style_bg_opa(button, LV_OPA_COVER, 0);
        lv_obj_set_style_border_color(button, ui_grid_lvgl_hex(adapter->theme.border_color), 0);
        lv_obj_set_style_border_width(button, 0, 0);
        lv_obj_set_style_border_side(button, LV_BORDER_SIDE_RIGHT, 0);
        lv_obj_set_style_shadow_width(button, 0, 0);
        lv_obj_set_style_text_color(button, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);
        lv_label_set_text(title_label, title_text);
        lv_obj_set_style_text_color(title_label, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);
        lv_label_set_long_mode(title_label, LV_LABEL_LONG_CLIP);
        lv_obj_set_width(title_label, resolved_width > 110 ? resolved_width - 90 : resolved_width / 2);
        lv_obj_align(title_label, LV_ALIGN_LEFT_MID, 10, 0);

        lv_label_set_text(controls_label, controls_text);
        lv_obj_set_style_text_color(
            controls_label,
            direction == UI_GRID_LVGL_SORT_NONE && !is_grouped && pin_side == NULL
                ? ui_grid_lvgl_hex(adapter->theme.muted_color)
                : ui_grid_lvgl_hex(adapter->theme.accent),
            0
        );
        lv_obj_align(controls_label, LV_ALIGN_RIGHT_MID, -12, 0);

        lv_obj_add_event_cb(button, ui_grid_lvgl_header_drag_event, LV_EVENT_PRESSED, &adapter->header_refs[index]);
        lv_obj_add_event_cb(button, ui_grid_lvgl_header_drag_event, LV_EVENT_PRESSING, &adapter->header_refs[index]);
        lv_obj_add_event_cb(button, ui_grid_lvgl_header_drag_event, LV_EVENT_RELEASED, &adapter->header_refs[index]);
        lv_obj_add_event_cb(button, ui_grid_lvgl_header_drag_event, LV_EVENT_PRESS_LOST, &adapter->header_refs[index]);

        if (adapter->enable_filtering && columns[index].filterable && columns[index].enable_filtering) {
            lv_obj_t *filter_input = lv_textarea_create(column_container);
            adapter->header_refs[index].filter_input = filter_input;
            lv_obj_set_width(filter_input, resolved_width);
            lv_obj_set_height(filter_input, 32);
            lv_textarea_set_one_line(filter_input, true);
            lv_textarea_set_placeholder_text(filter_input, "Filter...");
            lv_textarea_set_text(filter_input, active_filter != NULL ? active_filter : "");
            lv_obj_set_style_radius(filter_input, 0, 0);
            lv_obj_set_style_border_width(filter_input, 1, 0);
            lv_obj_set_style_border_side(filter_input, LV_BORDER_SIDE_RIGHT | LV_BORDER_SIDE_BOTTOM, 0);
            lv_obj_set_style_border_color(filter_input, ui_grid_lvgl_hex(adapter->theme.border_color), 0);
            lv_obj_set_style_bg_color(filter_input, ui_grid_lvgl_hex(adapter->theme.surface), 0);
            lv_obj_set_style_bg_opa(filter_input, LV_OPA_COVER, 0);
            lv_obj_set_style_text_color(filter_input, ui_grid_lvgl_hex(adapter->theme.cell_color), 0);
            lv_obj_set_style_pad_left(filter_input, (int32_t)adapter->theme.header_padding_x, 0);
            lv_obj_set_style_pad_right(filter_input, (int32_t)adapter->theme.header_padding_x, 0);
            lv_obj_set_style_pad_top(filter_input, (int32_t)adapter->theme.filter_padding_y, 0);
            lv_obj_set_style_pad_bottom(filter_input, (int32_t)adapter->theme.filter_padding_y, 0);
            lv_obj_add_event_cb(filter_input, ui_grid_lvgl_filter_event, LV_EVENT_READY, &adapter->header_refs[index]);
            lv_obj_add_event_cb(filter_input, ui_grid_lvgl_filter_event, LV_EVENT_VALUE_CHANGED, &adapter->header_refs[index]);
            lv_group_t *default_group = lv_group_get_default();
            if (default_group != NULL) {
                lv_group_add_obj(default_group, filter_input);
            }
        }

        ui_grid_lvgl_apply_column_width(adapter, &adapter->header_refs[index], resolved_width);
    }

    {
        int total_width = 0;
        for (int index = 0; index < column_count; index++) {
            total_width += adapter->header_refs[index].width;
        }
        lv_obj_set_width(adapter->header_row, total_width);
    }
    adapter->suppress_filter_events = false;

    /* Restore focus + cursor on the textarea matching the column the user
     * was editing, if any. Without this, the keyboard indev focuses the
     * first focusable widget after each rebuild and typing skips columns. */
    if (adapter->pending_filter_focus_column != NULL) {
        for (int index = 0; index < adapter->header_ref_count; index++) {
            ui_grid_lvgl_header_ref_t *ref = &adapter->header_refs[index];
            if (ref->filter_input == NULL || ref->column_name == NULL) {
                continue;
            }
            if (strcmp(ref->column_name, adapter->pending_filter_focus_column) != 0) {
                continue;
            }
            lv_group_t *group = lv_group_get_default();
            if (group != NULL) {
                lv_group_focus_obj(ref->filter_input);
            }
            uint32_t len = (uint32_t)strlen(lv_textarea_get_text(ref->filter_input));
            uint32_t pos = adapter->pending_filter_focus_pos;
            if (pos > len) pos = len;
            lv_textarea_set_cursor_pos(ref->filter_input, (int32_t)pos);
            break;
        }
        free(adapter->pending_filter_focus_column);
        adapter->pending_filter_focus_column = NULL;
    }
}

static int ui_grid_lvgl_parse_json(const char *json, jsmntok_t **tokens_out, int *token_count_out) {
    int result;
    int token_capacity = 256;
    jsmn_parser parser;
    jsmntok_t *tokens;

    tokens = (jsmntok_t *)malloc(sizeof(*tokens) * (size_t)token_capacity);
    if (tokens == NULL) {
        return JSMN_ERROR_NOMEM;
    }

    for (;;) {
        jsmn_init(&parser);
        result = jsmn_parse(&parser, json, strlen(json), tokens, (unsigned int)token_capacity);
        if (result != JSMN_ERROR_NOMEM) {
            break;
        }

        token_capacity *= 2;
        jsmntok_t *resized = (jsmntok_t *)realloc(tokens, sizeof(*tokens) * (size_t)token_capacity);
        if (resized == NULL) {
            free(tokens);
            return JSMN_ERROR_NOMEM;
        }

        tokens = resized;
    }

    if (result < 0) {
        free(tokens);
        return result;
    }

    *tokens_out = tokens;
    *token_count_out = result;
    return 0;
}

static void ui_grid_lvgl_render_error(ui_grid_lvgl_adapter_t *adapter, const char *message) {
    ui_grid_lvgl_clear_headers(adapter);
    lv_table_set_column_count(adapter->table, 1);
    lv_table_set_row_count(adapter->table, 1);
    lv_table_set_cell_value(adapter->table, 0, 0, message);
    lv_label_set_text(adapter->footer_label, "error");
}

static bool ui_grid_lvgl_extract_columns(
    const char *json,
    const jsmntok_t *tokens,
    int visible_columns_index,
    ui_grid_lvgl_column_t **columns_out,
    int *column_count_out
) {
    int column_count;
    ui_grid_lvgl_column_t *columns;

    if (visible_columns_index < 0 || tokens[visible_columns_index].type != JSMN_ARRAY) {
        return false;
    }

    column_count = tokens[visible_columns_index].size;
    if (column_count <= 0) {
        return false;
    }

    columns = (ui_grid_lvgl_column_t *)calloc((size_t)column_count, sizeof(*columns));
    if (columns == NULL) {
        return false;
    }

    for (int column_index = 0; column_index < column_count; column_index++) {
        int column_token = ui_grid_lvgl_array_item(tokens, visible_columns_index, column_index);
        int name_token = ui_grid_lvgl_object_find(json, tokens, column_token, "name");
        int label_token = ui_grid_lvgl_object_find(json, tokens, column_token, "displayName");
        int width_token = ui_grid_lvgl_object_find(json, tokens, column_token, "width");
        int filterable_token = ui_grid_lvgl_object_find(json, tokens, column_token, "filterable");
        int enable_filtering_token = ui_grid_lvgl_object_find(json, tokens, column_token, "enableFiltering");

        if (column_token < 0 || name_token < 0) {
            free(columns);
            return false;
        }

        columns[column_index].name = ui_grid_lvgl_token_strdup(json, &tokens[name_token]);
        if (columns[column_index].name == NULL) {
            free(columns);
            return false;
        }

        if (label_token >= 0 && !ui_grid_lvgl_token_equals(json, &tokens[label_token], "null")) {
            columns[column_index].label = ui_grid_lvgl_token_strdup(json, &tokens[label_token]);
        }

        if (columns[column_index].label == NULL) {
            columns[column_index].label = strdup(columns[column_index].name);
        }

        if (width_token >= 0 && !ui_grid_lvgl_token_equals(json, &tokens[width_token], "null")) {
            columns[column_index].width_text = ui_grid_lvgl_token_strdup(json, &tokens[width_token]);
        }

        columns[column_index].filterable = filterable_token >= 0
            ? ui_grid_lvgl_token_is_true(json, &tokens[filterable_token])
            : true;
        columns[column_index].enable_filtering = enable_filtering_token >= 0
            ? ui_grid_lvgl_token_is_true(json, &tokens[enable_filtering_token])
            : true;

        if (columns[column_index].label == NULL) {
            free(columns[column_index].name);
            free(columns);
            return false;
        }
    }

    *columns_out = columns;
    *column_count_out = column_count;
    return true;
}

static void ui_grid_lvgl_free_columns(ui_grid_lvgl_column_t *columns, int column_count) {
    if (columns == NULL) {
        return;
    }

    for (int column_index = 0; column_index < column_count; column_index++) {
        free(columns[column_index].name);
        free(columns[column_index].label);
        free(columns[column_index].width_text);
    }

    free(columns);
}

static void ui_grid_lvgl_render_row_entity(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int table_row,
    int row_object_index,
    int entity_index,
    const ui_grid_lvgl_column_t *columns,
    int column_count
) {
    int tree_level_index = ui_grid_lvgl_object_find(json, tokens, row_object_index, "treeLevel");
    int has_children_index = ui_grid_lvgl_object_find(json, tokens, row_object_index, "hasChildren");
    int expanded_index = ui_grid_lvgl_object_find(json, tokens, row_object_index, "expanded");
    int tree_level = tree_level_index >= 0 ? ui_grid_lvgl_token_to_int(json, &tokens[tree_level_index], 0) : 0;
    bool has_children = has_children_index >= 0 ? ui_grid_lvgl_token_is_true(json, &tokens[has_children_index]) : false;
    bool expanded = expanded_index >= 0 ? ui_grid_lvgl_token_is_true(json, &tokens[expanded_index]) : false;

    for (int column_index = 0; column_index < column_count; column_index++) {
        int value_index = ui_grid_lvgl_object_find(json, tokens, entity_index, columns[column_index].name);
        char *cell_text = NULL;
        char decorated[256];
        char formatted[256];
        const ui_grid_lvgl_column_ext_t *ext = ui_grid_lvgl_find_column_ext(adapter, columns[column_index].name);
        int row_id_index = ui_grid_lvgl_object_find(json, tokens, row_object_index, "id");
        char *row_id = row_id_index >= 0 ? ui_grid_lvgl_token_strdup(json, &tokens[row_id_index]) : NULL;

        if (value_index >= 0) {
            cell_text = ui_grid_lvgl_value_to_text(json, tokens, value_index);
        }

        if (ext != NULL && ext->formatter != NULL) {
            ui_grid_lvgl_cell_context_t context = {
                .value_text = cell_text != NULL ? cell_text : "",
                .row_id = row_id != NULL ? row_id : "",
                .column_name = columns[column_index].name,
                .theme = &adapter->theme,
                .row_index = (size_t)(table_row - 1),
            };
            if (ext->formatter(&context, formatted, sizeof(formatted), ext->user_data)) {
                free(cell_text);
                cell_text = ui_grid_lvgl_strdup(formatted);
            }
        }

        if (ext != NULL && ext->cell_painter != NULL
            && adapter->cell_paints != NULL
            && table_row >= 0 && table_row < adapter->cell_paint_rows
            && column_index >= 0 && column_index < adapter->cell_paint_cols) {
            ui_grid_lvgl_lookup_state_t lookup_state = {
                .json = json,
                .tokens = tokens,
                .entity_index = entity_index,
                .scratch = {0},
            };
            ui_grid_lvgl_cell_paint_context_t paint_ctx = {
                .value_text = cell_text != NULL ? cell_text : "",
                .row_id = row_id != NULL ? row_id : "",
                .column_name = columns[column_index].name,
                .theme = &adapter->theme,
                .row_index = (size_t)table_row,
                .lookup_value = ui_grid_lvgl_paint_lookup,
                .lookup_state = &lookup_state,
            };
            ui_grid_lvgl_cell_paint_t paint = {0};
            if (ext->cell_painter(&paint_ctx, &paint, ext->user_data)) {
                adapter->cell_paints[table_row * adapter->cell_paint_cols + column_index] = paint;
            }
        }

        if (column_index == 0 && cell_text != NULL) {
            snprintf(
                decorated,
                sizeof(decorated),
                "%*s%s%s",
                tree_level * 2,
                "",
                has_children ? (expanded ? "v " : "> ") : "",
                cell_text
            );
            lv_table_set_cell_value(adapter->table, (uint32_t)table_row, (uint32_t)column_index, decorated);
        } else {
            lv_table_set_cell_value(
                adapter->table,
                (uint32_t)table_row,
                (uint32_t)column_index,
                cell_text != NULL ? cell_text : ""
            );
        }

        free(cell_text);
        free(row_id);
    }
}

static void ui_grid_lvgl_render_special_item(
    ui_grid_lvgl_adapter_t *adapter,
    const char *json,
    const jsmntok_t *tokens,
    int table_row,
    int item_index,
    int column_count
) {
    int kind_index = ui_grid_lvgl_object_find(json, tokens, item_index, "kind");
    if (kind_index >= 0 && ui_grid_lvgl_token_equals(json, &tokens[kind_index], "group")) {
        int label_index = ui_grid_lvgl_object_find(json, tokens, item_index, "label");
        int depth_index = ui_grid_lvgl_object_find(json, tokens, item_index, "depth");
        int count_index = ui_grid_lvgl_object_find(json, tokens, item_index, "count");
        int collapsed_index = ui_grid_lvgl_object_find(json, tokens, item_index, "collapsed");
        char *label = label_index >= 0 ? ui_grid_lvgl_token_strdup(json, &tokens[label_index]) : ui_grid_lvgl_strdup("group");
        int depth = depth_index >= 0 ? ui_grid_lvgl_token_to_int(json, &tokens[depth_index], 0) : 0;
        int count = count_index >= 0 ? ui_grid_lvgl_token_to_int(json, &tokens[count_index], 0) : 0;
        bool collapsed = collapsed_index >= 0 ? ui_grid_lvgl_token_is_true(json, &tokens[collapsed_index]) : false;
        char buffer[256];
        snprintf(
            buffer,
            sizeof(buffer),
            "%*s%s %s (%d)",
            depth * 2,
            "",
            collapsed ? ">" : "v",
            label != NULL ? label : "group",
            count
        );
        lv_table_set_cell_value(adapter->table, (uint32_t)table_row, 0, buffer);
        free(label);
    } else if (kind_index >= 0 && ui_grid_lvgl_token_equals(json, &tokens[kind_index], "expandable")) {
        int row_index = ui_grid_lvgl_object_find(json, tokens, item_index, "row");
        int row_id_index = row_index >= 0 ? ui_grid_lvgl_object_find(json, tokens, row_index, "id") : -1;
        char *row_id = row_id_index >= 0 ? ui_grid_lvgl_token_strdup(json, &tokens[row_id_index]) : ui_grid_lvgl_strdup("row");
        char buffer[256];
        snprintf(buffer, sizeof(buffer), "Details: %s", row_id != NULL ? row_id : "row");
        lv_table_set_cell_value(adapter->table, (uint32_t)table_row, 0, buffer);
        free(row_id);
    } else {
        const char *kind_text = kind_index >= 0 ? json + tokens[kind_index].start : "item";
        int kind_length = kind_index >= 0 ? tokens[kind_index].end - tokens[kind_index].start : 4;
        char buffer[128];
        snprintf(buffer, sizeof(buffer), "[%.*s]", kind_length, kind_text);
        lv_table_set_cell_value(adapter->table, (uint32_t)table_row, 0, buffer);
    }

    for (int column_index = 1; column_index < column_count; column_index++) {
        lv_table_set_cell_value(adapter->table, (uint32_t)table_row, (uint32_t)column_index, "");
    }
}

static bool ui_grid_lvgl_render_projection_table(ui_grid_lvgl_adapter_t *adapter, const char *projection_json) {
    int parse_result;
    int token_count = 0;
    jsmntok_t *tokens = NULL;
    int payload_index;
    int visible_columns_index;
    int pipeline_index;
    int display_items_index;
    int display_item_count;
    ui_grid_lvgl_column_t *columns = NULL;
    int column_count = 0;

    parse_result = ui_grid_lvgl_parse_json(projection_json, &tokens, &token_count);
    if (parse_result < 0 || token_count <= 0 || tokens[0].type != JSMN_OBJECT) {
        free(tokens);
        ui_grid_lvgl_set_error_text(adapter, "failed to parse projection JSON");
        ui_grid_lvgl_render_error(adapter, adapter->last_error);
        return false;
    }

    payload_index = ui_grid_lvgl_object_find(projection_json, tokens, 0, "payload");
    visible_columns_index = payload_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, payload_index, "visibleColumns") : -1;
    pipeline_index = payload_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, payload_index, "pipeline") : -1;
    display_items_index = pipeline_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, pipeline_index, "displayItems") : -1;

    if (payload_index < 0 || visible_columns_index < 0 || display_items_index < 0) {
        free(tokens);
        ui_grid_lvgl_set_error_text(adapter, "projection envelope is missing visible columns or display items");
        ui_grid_lvgl_render_error(adapter, adapter->last_error);
        return false;
    }

    ui_grid_lvgl_update_sort_state(adapter, projection_json, tokens, payload_index);
    ui_grid_lvgl_update_grouping_state(adapter, projection_json, tokens, payload_index);
    ui_grid_lvgl_update_pinning_state(adapter, projection_json, tokens, payload_index);
    ui_grid_lvgl_update_filter_state(adapter, projection_json, tokens, payload_index);
    if (!ui_grid_lvgl_extract_columns(projection_json, tokens, visible_columns_index, &columns, &column_count)) {
        free(tokens);
        ui_grid_lvgl_set_error_text(adapter, "failed to parse visible columns from projection");
        ui_grid_lvgl_render_error(adapter, adapter->last_error);
        return false;
    }
    display_item_count = tokens[display_items_index].size;
    lv_table_set_column_count(adapter->table, (uint32_t)column_count);
    lv_table_set_row_count(adapter->table, (uint32_t)(display_item_count > 0 ? display_item_count : 1));
    ui_grid_lvgl_render_headers(adapter, columns, column_count);

    /* Reset and reserve per-render caches */
    ui_grid_lvgl_clear_display_rows(adapter);
    ui_grid_lvgl_reserve_display_rows(adapter, display_item_count > 0 ? display_item_count : 1);
    ui_grid_lvgl_reserve_cell_paints(adapter, display_item_count > 0 ? display_item_count : 1, column_count);

    if (display_item_count == 0) {
        lv_table_set_cell_value(adapter->table, 0, 0, "No rows");
        for (int column_index = 1; column_index < column_count; column_index++) {
            lv_table_set_cell_value(adapter->table, 0, (uint32_t)column_index, "");
        }
    }

    for (int row_index = 0; row_index < display_item_count; row_index++) {
        int item_index = ui_grid_lvgl_array_item(tokens, display_items_index, row_index);
        int kind_index = item_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, item_index, "kind") : -1;
        int row_object_index = item_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, item_index, "row") : -1;
        int entity_index = row_object_index >= 0 ? ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "entity") : -1;

        /* Capture metadata for click dispatch */
        if (row_index < adapter->display_row_capacity) {
            adapter->display_rows[row_index].row_id = NULL;
            adapter->display_rows[row_index].group_key = NULL;
            adapter->display_rows[row_index].kind = 0;
            adapter->display_rows[row_index].has_children = false;
            adapter->display_rows[row_index].expanded = false;
            adapter->display_rows[row_index].depth = 0;
            if (kind_index >= 0 && ui_grid_lvgl_token_equals(projection_json, &tokens[kind_index], "row") && row_object_index >= 0) {
                int row_id_index = ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "id");
                int has_children_index = ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "hasChildren");
                int expanded_index = ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "expanded");
                int tree_level_index = ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "treeLevel");
                bool has_children = has_children_index >= 0 ? ui_grid_lvgl_token_is_true(projection_json, &tokens[has_children_index]) : false;
                bool expanded = expanded_index >= 0 ? ui_grid_lvgl_token_is_true(projection_json, &tokens[expanded_index]) : false;
                int tree_level = tree_level_index >= 0 ? ui_grid_lvgl_token_to_int(projection_json, &tokens[tree_level_index], 0) : 0;
                adapter->display_rows[row_index].kind = has_children || tree_level > 0 ? 3 : 0;
                adapter->display_rows[row_index].has_children = has_children;
                adapter->display_rows[row_index].expanded = expanded;
                adapter->display_rows[row_index].depth = tree_level;
                if (row_id_index >= 0) {
                    adapter->display_rows[row_index].row_id = ui_grid_lvgl_token_strdup(projection_json, &tokens[row_id_index]);
                }
            } else if (kind_index >= 0 && ui_grid_lvgl_token_equals(projection_json, &tokens[kind_index], "expandable") && row_object_index >= 0) {
                int row_id_index = ui_grid_lvgl_object_find(projection_json, tokens, row_object_index, "id");
                adapter->display_rows[row_index].kind = 2;
                if (row_id_index >= 0) {
                    adapter->display_rows[row_index].row_id = ui_grid_lvgl_token_strdup(projection_json, &tokens[row_id_index]);
                }
            } else if (kind_index >= 0 && ui_grid_lvgl_token_equals(projection_json, &tokens[kind_index], "group")) {
                int key_index = ui_grid_lvgl_object_find(projection_json, tokens, item_index, "key");
                int collapsed_index = ui_grid_lvgl_object_find(projection_json, tokens, item_index, "collapsed");
                int depth_index = ui_grid_lvgl_object_find(projection_json, tokens, item_index, "depth");
                adapter->display_rows[row_index].kind = 1;
                adapter->display_rows[row_index].expanded = collapsed_index >= 0
                    ? !ui_grid_lvgl_token_is_true(projection_json, &tokens[collapsed_index])
                    : true;
                adapter->display_rows[row_index].depth = depth_index >= 0
                    ? ui_grid_lvgl_token_to_int(projection_json, &tokens[depth_index], 0)
                    : 0;
                if (key_index >= 0) {
                    adapter->display_rows[row_index].group_key = ui_grid_lvgl_token_strdup(projection_json, &tokens[key_index]);
                }
            }
            if (row_index >= adapter->display_row_count) {
                adapter->display_row_count = row_index + 1;
            }
        }

        if (kind_index >= 0 && ui_grid_lvgl_token_equals(projection_json, &tokens[kind_index], "row") && entity_index >= 0) {
            ui_grid_lvgl_render_row_entity(adapter, projection_json, tokens, row_index, row_object_index, entity_index, columns, column_count);
        } else {
            ui_grid_lvgl_render_special_item(adapter, projection_json, tokens, row_index, item_index, column_count);
        }
    }

    {
        int total_items_index = ui_grid_lvgl_object_find(projection_json, tokens, pipeline_index, "totalItems");
        int current_page_index = ui_grid_lvgl_object_find(projection_json, tokens, payload_index, "currentPage");
        int page_size_index = ui_grid_lvgl_object_find(projection_json, tokens, payload_index, "pageSize");
        int virtualization_index = ui_grid_lvgl_object_find(projection_json, tokens, pipeline_index, "virtualizationEnabled");
        int total_items = total_items_index >= 0 ? ui_grid_lvgl_token_to_int(projection_json, &tokens[total_items_index], display_item_count) : display_item_count;
        int current_page = current_page_index >= 0 ? ui_grid_lvgl_token_to_int(projection_json, &tokens[current_page_index], 1) : 1;
        int page_size = page_size_index >= 0 ? ui_grid_lvgl_token_to_int(projection_json, &tokens[page_size_index], 0) : 0;
        bool virtualization_enabled = virtualization_index >= 0 ? ui_grid_lvgl_token_is_true(projection_json, &tokens[virtualization_index]) : false;
        char footer_text[160];
        snprintf(
            footer_text,
            sizeof(footer_text),
            "Rows: %d  Page: %d  Page size: %d  Virtualized: %s",
            total_items,
            current_page,
            page_size,
            virtualization_enabled ? "yes" : "no"
        );
        lv_label_set_text(adapter->footer_label, footer_text);
    }

    ui_grid_lvgl_free_columns(columns, column_count);
    free(tokens);
    adapter->last_error[0] = '\0';
    return true;
}

static void ui_grid_lvgl_copy_last_error(ui_grid_lvgl_adapter_t *adapter, const char *fallback) {
    char *error = ui_grid_engine_last_error_message(adapter->engine);
    if (error != NULL) {
        snprintf(adapter->last_error, sizeof(adapter->last_error), "%s", error);
        ui_grid_string_free(error);
        return;
    }

    snprintf(adapter->last_error, sizeof(adapter->last_error), "%s", fallback);
}

static void ui_grid_lvgl_set_error_text(ui_grid_lvgl_adapter_t *adapter, const char *message) {
    snprintf(adapter->last_error, sizeof(adapter->last_error), "%s", message);
}

static const char *sort_direction_to_json(ui_grid_lvgl_sort_direction_t direction) {
    switch (direction) {
        case UI_GRID_LVGL_SORT_NONE:
            return "none";
        case UI_GRID_LVGL_SORT_ASC:
            return "asc";
        case UI_GRID_LVGL_SORT_DESC:
            return "desc";
    }

    return "none";
}

ui_grid_lvgl_adapter_t *ui_grid_lvgl_create(
    lv_obj_t *parent,
    const ui_grid_lvgl_adapter_config_t *config
) {
    ui_grid_lvgl_adapter_t *adapter = (ui_grid_lvgl_adapter_t *)calloc(1, sizeof(*adapter));
    if (adapter == NULL) {
        return NULL;
    }

    adapter->engine = ui_grid_engine_create();
    if (adapter->engine == NULL) {
        free(adapter);
        return NULL;
    }

    adapter->row_height = config != NULL && config->row_height > 0 ? config->row_height : 44;
    adapter->enable_column_resizing = config != NULL ? config->enable_column_resizing : false;
    adapter->use_message_pack = config != NULL ? config->use_message_pack : false;
    adapter->theme = config != NULL && config->theme != NULL
        ? *config->theme
        : ui_grid_lvgl_theme_default_dark();
    adapter->column_exts = config != NULL ? config->column_exts : NULL;
    adapter->column_ext_count = config != NULL ? config->column_ext_count : 0;
    adapter->current_sort_direction = UI_GRID_LVGL_SORT_NONE;
    adapter->root = lv_obj_create(parent);
    lv_obj_set_size(adapter->root, LV_PCT(100), LV_PCT(100));
    lv_obj_set_layout(adapter->root, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(adapter->root, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_all(adapter->root, 0, 0);

    adapter->header_clip = lv_obj_create(adapter->root);
    lv_obj_set_width(adapter->header_clip, LV_PCT(100));
    lv_obj_set_height(adapter->header_clip, 34);
    lv_obj_set_style_pad_all(adapter->header_clip, 0, 0);
    lv_obj_set_style_border_width(adapter->header_clip, 0, 0);
    lv_obj_set_style_bg_opa(adapter->header_clip, LV_OPA_TRANSP, 0);
    lv_obj_remove_flag(adapter->header_clip, LV_OBJ_FLAG_SCROLLABLE);

    adapter->header_row = lv_obj_create(adapter->header_clip);
    lv_obj_set_width(adapter->header_row, LV_PCT(100));
    lv_obj_set_height(adapter->header_row, 34);
    lv_obj_set_pos(adapter->header_row, 0, 0);
    lv_obj_set_layout(adapter->header_row, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(adapter->header_row, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_all(adapter->header_row, 0, 0);
    lv_obj_set_style_pad_gap(adapter->header_row, 0, 0);
    lv_obj_remove_flag(adapter->header_row, LV_OBJ_FLAG_SCROLLABLE);

    adapter->table = lv_table_create(adapter->root);
    lv_obj_set_width(adapter->table, LV_PCT(100));
    lv_obj_set_flex_grow(adapter->table, 1);
    lv_obj_add_flag(adapter->table, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(adapter->table, LV_DIR_ALL);
    lv_obj_set_scrollbar_mode(adapter->table, LV_SCROLLBAR_MODE_ACTIVE);
    lv_obj_add_flag(adapter->table, LV_OBJ_FLAG_SEND_DRAW_TASK_EVENTS);
    lv_obj_set_style_pad_top(adapter->table, (int32_t)adapter->theme.cell_padding_y, LV_PART_ITEMS);
    lv_obj_set_style_pad_bottom(adapter->table, (int32_t)adapter->theme.cell_padding_y, LV_PART_ITEMS);
    lv_obj_set_style_pad_left(adapter->table, (int32_t)adapter->theme.cell_padding_x, LV_PART_ITEMS);
    lv_obj_set_style_pad_right(adapter->table, (int32_t)adapter->theme.cell_padding_x, LV_PART_ITEMS);
    lv_obj_add_event_cb(adapter->table, ui_grid_lvgl_table_draw_event, LV_EVENT_DRAW_TASK_ADDED, adapter);
    lv_obj_add_event_cb(adapter->table, ui_grid_lvgl_table_scroll_event, LV_EVENT_SCROLL, adapter);
    lv_obj_add_event_cb(adapter->table, ui_grid_lvgl_table_clicked_event, LV_EVENT_VALUE_CHANGED, adapter);
    lv_table_set_column_count(adapter->table, 1);
    lv_table_set_row_count(adapter->table, 1);
    lv_table_set_cell_value(adapter->table, 0, 0, "Waiting for projection");

    adapter->footer_label = lv_label_create(adapter->root);
    lv_obj_set_width(adapter->footer_label, LV_PCT(100));
    lv_label_set_text(adapter->footer_label, "Rows: 0");
    ui_grid_lvgl_apply_theme(adapter);
    adapter->last_error[0] = '\0';
    return adapter;
}

void ui_grid_lvgl_destroy(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL) {
        return;
    }

    ui_grid_lvgl_clear_headers(adapter);
    ui_grid_lvgl_free_string(&adapter->current_sort_column);
    ui_grid_lvgl_free_group_by_columns(adapter);
    ui_grid_lvgl_free_pinned_columns(adapter);
    ui_grid_lvgl_free_active_filters(adapter);
    ui_grid_lvgl_free_column_widths(adapter);
    ui_grid_lvgl_free_string(&adapter->drag_source_column);
    ui_grid_lvgl_free_string(&adapter->resize_column);

    ui_grid_lvgl_clear_display_rows(adapter);
    free(adapter->display_rows);
    free(adapter->cell_paints);
    for (int index = 0; index < adapter->expanded_tree_count; index++) {
        free(adapter->expanded_tree_ids[index]);
    }
    free(adapter->expanded_tree_ids);
    for (int index = 0; index < adapter->expanded_row_count; index++) {
        free(adapter->expanded_row_ids[index]);
    }
    free(adapter->expanded_row_ids);

    free(adapter->pending_filter_focus_column);

    if (adapter->root != NULL) {
        lv_obj_delete(adapter->root);
    }

    if (adapter->engine != NULL) {
        ui_grid_engine_destroy(adapter->engine);
    }

    free(adapter);
}

lv_obj_t *ui_grid_lvgl_root(ui_grid_lvgl_adapter_t *adapter) {
    return adapter != NULL ? adapter->root : NULL;
}

void ui_grid_lvgl_scroll_table_by(ui_grid_lvgl_adapter_t *adapter, int dx, int dy) {
    if (adapter == NULL || adapter->table == NULL) {
        return;
    }
    lv_obj_scroll_by_bounded(adapter->table, dx, dy, LV_ANIM_OFF);
}

bool ui_grid_lvgl_set_options_json(ui_grid_lvgl_adapter_t *adapter, const char *options_json) {
    if (adapter == NULL || options_json == NULL) {
        return false;
    }

    if (!ui_grid_engine_set_options_json(adapter->engine, options_json)) {
        ui_grid_lvgl_copy_last_error(adapter, "set options failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_set_options_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *options_bytes,
    size_t options_len
) {
    if (adapter == NULL || options_bytes == NULL) {
        return false;
    }

    if (!ui_grid_engine_set_options_bytes(adapter->engine, (uint32_t)codec, options_bytes, options_len)) {
        ui_grid_lvgl_copy_last_error(adapter, "set options failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_set_rows_json(ui_grid_lvgl_adapter_t *adapter, const char *rows_json) {
    if (adapter == NULL || rows_json == NULL) {
        return false;
    }

    if (!ui_grid_engine_set_rows_json(adapter->engine, rows_json)) {
        ui_grid_lvgl_copy_last_error(adapter, "set rows failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_set_rows_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *rows_bytes,
    size_t rows_len
) {
    if (adapter == NULL || rows_bytes == NULL) {
        return false;
    }

    if (!ui_grid_engine_set_rows_bytes(adapter->engine, (uint32_t)codec, rows_bytes, rows_len)) {
        ui_grid_lvgl_copy_last_error(adapter, "set rows failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_apply_command_json(ui_grid_lvgl_adapter_t *adapter, const char *command_json) {
    if (adapter == NULL || command_json == NULL) {
        return false;
    }

    if (!ui_grid_engine_apply_command_json(adapter->engine, command_json)) {
        ui_grid_lvgl_copy_last_error(adapter, "apply command failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_apply_command_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *command_bytes,
    size_t command_len
) {
    if (adapter == NULL || command_bytes == NULL) {
        return false;
    }

    if (!ui_grid_engine_apply_command_bytes(adapter->engine, (uint32_t)codec, command_bytes, command_len)) {
        ui_grid_lvgl_copy_last_error(adapter, "apply command failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

char *ui_grid_lvgl_save_state_json(ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL) {
        return NULL;
    }

    return ui_grid_engine_save_state_json(adapter->engine);
}

unsigned char *ui_grid_lvgl_save_state_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    size_t *out_len
) {
    if (adapter == NULL) {
        return NULL;
    }

    return ui_grid_engine_save_state_bytes(adapter->engine, (uint32_t)codec, out_len);
}

bool ui_grid_lvgl_restore_state_json(ui_grid_lvgl_adapter_t *adapter, const char *state_json) {
    if (adapter == NULL || state_json == NULL) {
        return false;
    }

    if (!ui_grid_engine_restore_state_json(adapter->engine, state_json)) {
        ui_grid_lvgl_copy_last_error(adapter, "restore state failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_restore_state_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *state_bytes,
    size_t state_len
) {
    if (adapter == NULL || state_bytes == NULL) {
        return false;
    }

    if (!ui_grid_engine_restore_state_bytes(adapter->engine, (uint32_t)codec, state_bytes, state_len)) {
        ui_grid_lvgl_copy_last_error(adapter, "restore state failed");
        return false;
    }

    return ui_grid_lvgl_refresh(adapter);
}

bool ui_grid_lvgl_sort_by(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    ui_grid_lvgl_sort_direction_t direction
) {
    char command[256];

    if (adapter == NULL || column_name == NULL) {
        return false;
    }

    snprintf(
        command,
        sizeof(command),
        "{\"kind\":\"setSort\",\"columnName\":\"%s\",\"direction\":\"%s\"}",
        column_name,
        sort_direction_to_json(direction)
    );

    return ui_grid_lvgl_apply_command_json(adapter, command);
}

bool ui_grid_lvgl_move_column_before(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    const char *target_column_name
) {
    char *command_json;
    bool success;

    if (adapter == NULL || column_name == NULL || target_column_name == NULL) {
        return false;
    }

    command_json = ui_grid_lvgl_build_column_order_json(adapter, column_name, target_column_name);
    if (command_json == NULL) {
        ui_grid_lvgl_set_error_text(adapter, "failed to build column reorder command");
        return false;
    }

    success = ui_grid_lvgl_apply_command_json(adapter, command_json);
    free(command_json);
    return success;
}

bool ui_grid_lvgl_refresh(ui_grid_lvgl_adapter_t *adapter) {
    char *projection_json;

    if (adapter == NULL) {
        return false;
    }

    projection_json = ui_grid_engine_get_projection_json(adapter->engine);
    if (projection_json == NULL) {
        ui_grid_lvgl_copy_last_error(adapter, "projection refresh failed");
        return false;
    }

    if (!ui_grid_lvgl_render_projection_table(adapter, projection_json)) {
        ui_grid_string_free(projection_json);
        return false;
    }

    ui_grid_string_free(projection_json);
    return true;
}

void ui_grid_lvgl_set_theme(ui_grid_lvgl_adapter_t *adapter, const ui_grid_lvgl_theme_t *theme) {
    if (adapter == NULL || theme == NULL) {
        return;
    }

    adapter->theme = *theme;
    ui_grid_lvgl_apply_theme(adapter);
    ui_grid_lvgl_refresh(adapter);
}

const char *ui_grid_lvgl_last_error(const ui_grid_lvgl_adapter_t *adapter) {
    if (adapter == NULL) {
        return "adapter is null";
    }

    return adapter->last_error;
}