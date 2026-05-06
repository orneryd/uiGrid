use std::collections::BTreeMap;
use std::ffi::{CStr, CString, c_char};
use std::mem;
use std::slice;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ui_grid_contracts::{
    C_ABI_VERSION, COMMAND_SCHEMA_VERSION, ENGINE_CONTRACT_VERSION, PROJECTION_SCHEMA_VERSION,
    UiGridEngineCommand, UiGridProjectionEnvelope,
};
use ui_grid_core::{
    constants::SortDirection,
    models::{
        BuildGridPipelineContext, GridColumnDef, GridOptions, GridSavedState, PipelineResult,
        SortState,
    },
    pipeline::build_grid_pipeline,
    state::{normalize_grid_saved_state, serialize_grid_saved_state},
};

const DEFAULT_CURRENT_PAGE: usize = 1;
const DEFAULT_ROW_SIZE: usize = 44;

#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UiGridAbiCodec {
    Json = 1,
    MessagePack = 2,
}

impl TryFrom<u32> for UiGridAbiCodec {
    type Error = String;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Json),
            2 => Ok(Self::MessagePack),
            other => Err(format!("unsupported ui-grid ABI codec: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiGridProjection {
    pub options: GridOptions,
    pub visible_columns: Vec<GridColumnDef>,
    pub pipeline: PipelineResult,
    pub active_filters: BTreeMap<String, String>,
    pub sort_state: SortState,
    pub group_by_columns: Vec<String>,
    pub collapsed_groups: BTreeMap<String, bool>,
    pub expanded_rows: BTreeMap<String, bool>,
    pub expanded_tree_rows: BTreeMap<String, bool>,
    pub pinned_columns: BTreeMap<String, String>,
    pub current_page: usize,
    pub page_size: usize,
    pub row_size: usize,
}

#[derive(Debug, Default)]
pub struct UiGridAbiEngine {
    options: GridOptions,
    active_filters: BTreeMap<String, String>,
    sort_state: SortState,
    group_by_columns: Vec<String>,
    collapsed_groups: BTreeMap<String, bool>,
    hidden_row_reasons: BTreeMap<String, Vec<String>>,
    expanded_rows: BTreeMap<String, bool>,
    expanded_tree_rows: BTreeMap<String, bool>,
    pinned_columns: BTreeMap<String, String>,
    column_order: Vec<String>,
    current_page: usize,
    page_size: usize,
    row_size: usize,
    last_error: Option<String>,
}

impl UiGridAbiEngine {
    fn new() -> Self {
        Self {
            options: GridOptions::default(),
            active_filters: BTreeMap::new(),
            sort_state: SortState::default(),
            group_by_columns: Vec::new(),
            collapsed_groups: BTreeMap::new(),
            hidden_row_reasons: BTreeMap::new(),
            expanded_rows: BTreeMap::new(),
            expanded_tree_rows: BTreeMap::new(),
            pinned_columns: BTreeMap::new(),
            column_order: Vec::new(),
            current_page: DEFAULT_CURRENT_PAGE,
            page_size: 0,
            row_size: DEFAULT_ROW_SIZE,
            last_error: None,
        }
    }

    fn set_options_with_codec(
        &mut self,
        codec: UiGridAbiCodec,
        value: &[u8],
    ) -> Result<(), String> {
        let options: GridOptions = match codec {
            UiGridAbiCodec::Json => serde_json::from_slice(value)
                .map_err(|error| format!("failed to parse options JSON: {error}"))?,
            UiGridAbiCodec::MessagePack => rmp_serde::from_slice(value)
                .map_err(|error| format!("failed to parse options MessagePack: {error}"))?,
        };
        self.options = options;
        self.column_order = self
            .options
            .column_defs
            .iter()
            .map(|column| column.name.clone())
            .collect();
        self.group_by_columns = self
            .options
            .grouping
            .as_ref()
            .map(|grouping| grouping.group_by.clone())
            .unwrap_or_default();
        self.current_page = self
            .options
            .pagination_current_page
            .unwrap_or(DEFAULT_CURRENT_PAGE);
        self.page_size = self.options.pagination_page_size.unwrap_or(0);
        Ok(())
    }

    fn set_options_json(&mut self, value: &str) -> Result<(), String> {
        self.set_options_with_codec(UiGridAbiCodec::Json, value.as_bytes())
    }

    fn set_rows_with_codec(&mut self, codec: UiGridAbiCodec, value: &[u8]) -> Result<(), String> {
        self.options.data = match codec {
            UiGridAbiCodec::Json => serde_json::from_slice(value)
                .map_err(|error| format!("failed to parse rows JSON: {error}"))?,
            UiGridAbiCodec::MessagePack => rmp_serde::from_slice(value)
                .map_err(|error| format!("failed to parse rows MessagePack: {error}"))?,
        };
        Ok(())
    }

    fn set_rows_json(&mut self, value: &str) -> Result<(), String> {
        self.set_rows_with_codec(UiGridAbiCodec::Json, value.as_bytes())
    }

    fn apply_command_with_codec(
        &mut self,
        codec: UiGridAbiCodec,
        value: &[u8],
    ) -> Result<(), String> {
        let command: UiGridEngineCommand = match codec {
            UiGridAbiCodec::Json => serde_json::from_slice(value)
                .map_err(|error| format!("failed to parse command JSON: {error}"))?,
            UiGridAbiCodec::MessagePack => rmp_serde::from_slice(value)
                .map_err(|error| format!("failed to parse command MessagePack: {error}"))?,
        };
        self.apply_command(command)
    }

    fn apply_command_json(&mut self, value: &str) -> Result<(), String> {
        self.apply_command_with_codec(UiGridAbiCodec::Json, value.as_bytes())
    }

    fn apply_command(&mut self, command: UiGridEngineCommand) -> Result<(), String> {
        match command {
            UiGridEngineCommand::SetFilter { column_name, value } => {
                self.active_filters.insert(column_name, value);
            }
            UiGridEngineCommand::ClearFilters => {
                self.active_filters.clear();
            }
            UiGridEngineCommand::SetSort { sort } => {
                self.sort_state = SortState {
                    column_name: sort.column_name,
                    direction: parse_sort_direction(&sort.direction)?,
                };
            }
            UiGridEngineCommand::SetGrouping { grouping } => {
                self.group_by_columns = grouping.group_by;
            }
            UiGridEngineCommand::SetPagination {
                current_page,
                page_size,
            } => {
                self.current_page = current_page.max(1);
                self.page_size = page_size;
            }
            UiGridEngineCommand::SetCollapsedGroups { collapsed_groups } => {
                self.collapsed_groups = collapsed_groups;
            }
            UiGridEngineCommand::SetExpandedRows { expanded_rows } => {
                self.expanded_rows = expanded_rows;
            }
            UiGridEngineCommand::SetExpandedTreeRows { expanded_tree_rows } => {
                self.expanded_tree_rows = expanded_tree_rows;
            }
            UiGridEngineCommand::SetPinnedColumns { pinning } => {
                self.pinned_columns = pinning.pinned_columns;
            }
            UiGridEngineCommand::SetColumnOrder { order } => {
                self.column_order = order.column_order;
            }
        }

        Ok(())
    }

    fn get_projection(&self) -> UiGridProjectionEnvelope<UiGridProjection> {
        let visible_columns = order_visible_columns(&self.options.column_defs, &self.column_order);
        let pipeline = build_grid_pipeline(&BuildGridPipelineContext {
            options: self.options.clone(),
            columns: visible_columns.clone(),
            active_filters: self.active_filters.clone(),
            sort_state: self.sort_state.clone(),
            group_by_columns: self.group_by_columns.clone(),
            collapsed_groups: self.collapsed_groups.clone(),
            hidden_row_reasons: self.hidden_row_reasons.clone(),
            expanded_rows: self.expanded_rows.clone(),
            expanded_tree_rows: self.expanded_tree_rows.clone(),
            current_page: self.current_page.max(1),
            page_size: self.page_size,
            row_size: self.row_size,
        });

        UiGridProjectionEnvelope {
            engine_contract_version: ENGINE_CONTRACT_VERSION.to_string(),
            c_abi_version: C_ABI_VERSION.to_string(),
            projection_schema_version: PROJECTION_SCHEMA_VERSION.to_string(),
            command_schema_version: COMMAND_SCHEMA_VERSION.to_string(),
            payload: UiGridProjection {
                options: self.options.clone(),
                visible_columns,
                pipeline,
                active_filters: self.active_filters.clone(),
                sort_state: self.sort_state.clone(),
                group_by_columns: self.group_by_columns.clone(),
                collapsed_groups: self.collapsed_groups.clone(),
                expanded_rows: self.expanded_rows.clone(),
                expanded_tree_rows: self.expanded_tree_rows.clone(),
                pinned_columns: self.pinned_columns.clone(),
                current_page: self.current_page.max(1),
                page_size: self.page_size,
                row_size: self.row_size,
            },
        }
    }

    fn get_projection_with_codec(&mut self, codec: UiGridAbiCodec) -> Result<Vec<u8>, String> {
        match codec {
            UiGridAbiCodec::Json => serde_json::to_vec(&self.get_projection())
                .map_err(|error| format!("failed to serialize projection JSON: {error}")),
            UiGridAbiCodec::MessagePack => rmp_serde::to_vec_named(&self.get_projection())
                .map_err(|error| format!("failed to serialize projection MessagePack: {error}")),
        }
    }

    fn get_projection_json(&mut self) -> Result<*mut c_char, String> {
        let value = String::from_utf8(self.get_projection_with_codec(UiGridAbiCodec::Json)?)
            .map_err(|error| format!("failed to encode projection JSON as UTF-8: {error}"))?;
        string_into_raw(value)
    }

    fn save_state_with_codec(&mut self, codec: UiGridAbiCodec) -> Result<Vec<u8>, String> {
        let state = GridSavedState {
            column_order: self.column_order.clone(),
            filters: self.active_filters.clone(),
            sort: Some(self.sort_state.clone()),
            grouping: self.group_by_columns.clone(),
            pagination: Some(ui_grid_core::models::GridSavedPaginationState {
                pagination_current_page: self.current_page.max(1),
                pagination_page_size: self.page_size,
            }),
            expandable: self.expanded_rows.clone(),
            tree_view: self.expanded_tree_rows.clone(),
            pinning: self.pinned_columns.clone(),
        };
        match codec {
            UiGridAbiCodec::Json => serialize_grid_saved_state(&state)
                .map(|value| value.into_bytes())
                .map_err(|error| format!("failed to serialize state JSON: {error}")),
            UiGridAbiCodec::MessagePack => rmp_serde::to_vec_named(&state)
                .map_err(|error| format!("failed to serialize state MessagePack: {error}")),
        }
    }

    fn save_state_json(&mut self) -> Result<*mut c_char, String> {
        let serialized = String::from_utf8(self.save_state_with_codec(UiGridAbiCodec::Json)?)
            .map_err(|error| format!("failed to encode state JSON as UTF-8: {error}"))?;
        string_into_raw(serialized)
    }

    fn restore_state_with_codec(
        &mut self,
        codec: UiGridAbiCodec,
        value: &[u8],
    ) -> Result<(), String> {
        let state = match codec {
            UiGridAbiCodec::Json => {
                let parsed: Value = serde_json::from_slice(value)
                    .map_err(|error| format!("failed to parse state JSON: {error}"))?;
                normalize_grid_saved_state(&parsed)
            }
            UiGridAbiCodec::MessagePack => {
                let parsed: GridSavedState = rmp_serde::from_slice(value)
                    .map_err(|error| format!("failed to parse state MessagePack: {error}"))?;
                let parsed = serde_json::to_value(parsed).unwrap_or(Value::Null);
                normalize_grid_saved_state(&parsed)
            }
        };
        self.column_order = state.column_order;
        self.active_filters = state.filters;
        self.sort_state = state.sort.unwrap_or_default();
        self.group_by_columns = state.grouping;
        if let Some(pagination) = state.pagination {
            self.current_page = pagination.pagination_current_page.max(1);
            self.page_size = pagination.pagination_page_size;
        }
        self.expanded_rows = state.expandable;
        self.expanded_tree_rows = state.tree_view;
        self.pinned_columns = state.pinning;
        Ok(())
    }

    fn restore_state_json(&mut self, value: &str) -> Result<(), String> {
        self.restore_state_with_codec(UiGridAbiCodec::Json, value.as_bytes())
    }

    fn last_error_message(&self) -> Option<*mut c_char> {
        self.last_error
            .as_ref()
            .and_then(|value| string_into_raw(value.clone()).ok())
    }

    fn set_error(&mut self, value: impl Into<String>) -> bool {
        self.last_error = Some(value.into());
        false
    }

    fn clear_error(&mut self) {
        self.last_error = None;
    }
}

fn parse_sort_direction(value: &str) -> Result<SortDirection, String> {
    match value {
        "none" => Ok(SortDirection::None),
        "asc" => Ok(SortDirection::Asc),
        "desc" => Ok(SortDirection::Desc),
        other => Err(format!("unsupported sort direction: {other}")),
    }
}

fn order_visible_columns(columns: &[GridColumnDef], order: &[String]) -> Vec<GridColumnDef> {
    let mut visible = columns
        .iter()
        .filter(|column| column.visible)
        .cloned()
        .collect::<Vec<_>>();

    visible.sort_by_key(|column| {
        order
            .iter()
            .position(|name| name == &column.name)
            .unwrap_or(usize::MAX)
    });

    visible
}

fn string_into_raw(value: String) -> Result<*mut c_char, String> {
    CString::new(value)
        .map(CString::into_raw)
        .map_err(|error| format!("string contained interior NUL byte: {error}"))
}

fn bytes_into_raw(mut value: Vec<u8>) -> (*mut u8, usize) {
    let len = value.len();
    let ptr = value.as_mut_ptr();
    mem::forget(value);
    (ptr, len)
}

fn parse_json_input(input: *const c_char) -> Result<String, String> {
    if input.is_null() {
        return Err("received null string pointer".to_string());
    }

    let value = unsafe { CStr::from_ptr(input) };
    value
        .to_str()
        .map(ToOwned::to_owned)
        .map_err(|error| format!("received invalid UTF-8 input: {error}"))
}

fn parse_bytes_input<'a>(input: *const u8, len: usize) -> Result<&'a [u8], String> {
    if input.is_null() {
        return if len == 0 {
            Ok(&[])
        } else {
            Err("received null byte pointer".to_string())
        };
    }

    Ok(unsafe { slice::from_raw_parts(input, len) })
}

fn write_output_len(out_len: *mut usize, len: usize) -> Result<(), String> {
    if out_len.is_null() {
        return Err("received null output length pointer".to_string());
    }

    unsafe {
        *out_len = len;
    }
    Ok(())
}

fn with_engine_mut<T>(
    engine: *mut UiGridAbiEngine,
    callback: impl FnOnce(&mut UiGridAbiEngine) -> Result<T, String>,
) -> Result<T, String> {
    let engine =
        unsafe { engine.as_mut() }.ok_or_else(|| "received null engine pointer".to_string())?;
    callback(engine)
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_abi_version() -> *mut c_char {
    string_into_raw(C_ABI_VERSION.to_string()).unwrap_or(std::ptr::null_mut())
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_projection_schema_version() -> *mut c_char {
    string_into_raw(PROJECTION_SCHEMA_VERSION.to_string()).unwrap_or(std::ptr::null_mut())
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_command_schema_version() -> *mut c_char {
    string_into_raw(COMMAND_SCHEMA_VERSION.to_string()).unwrap_or(std::ptr::null_mut())
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_create() -> *mut UiGridAbiEngine {
    Box::into_raw(Box::new(UiGridAbiEngine::new()))
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `engine` must be either null or a pointer previously returned by
/// `ui_grid_engine_create` that has not already been freed.
pub unsafe extern "C" fn ui_grid_engine_destroy(engine: *mut UiGridAbiEngine) {
    if engine.is_null() {
        return;
    }

    unsafe {
        drop(Box::from_raw(engine));
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_set_options_json(
    engine: *mut UiGridAbiEngine,
    options_json: *const c_char,
) -> bool {
    let result = (|| {
        let options_json = parse_json_input(options_json)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.set_options_json(&options_json)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_set_options_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    options_bytes: *const u8,
    options_len: usize,
) -> bool {
    let result = (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        let options_bytes = parse_bytes_input(options_bytes, options_len)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.set_options_with_codec(codec, options_bytes)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_set_rows_json(
    engine: *mut UiGridAbiEngine,
    rows_json: *const c_char,
) -> bool {
    let result = (|| {
        let rows_json = parse_json_input(rows_json)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.set_rows_json(&rows_json)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_set_rows_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    rows_bytes: *const u8,
    rows_len: usize,
) -> bool {
    let result = (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        let rows_bytes = parse_bytes_input(rows_bytes, rows_len)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.set_rows_with_codec(codec, rows_bytes)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_apply_command_json(
    engine: *mut UiGridAbiEngine,
    command_json: *const c_char,
) -> bool {
    let result = (|| {
        let command_json = parse_json_input(command_json)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.apply_command_json(&command_json)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_apply_command_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    command_bytes: *const u8,
    command_len: usize,
) -> bool {
    let result = (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        let command_bytes = parse_bytes_input(command_bytes, command_len)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.apply_command_with_codec(codec, command_bytes)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_get_projection_json(engine: *mut UiGridAbiEngine) -> *mut c_char {
    match with_engine_mut(engine, |engine| {
        engine.clear_error();
        engine.get_projection_json()
    }) {
        Ok(value) => value,
        Err(error) => {
            let _ = with_engine_mut(engine, |engine| Ok(engine.set_error(error)));
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_get_projection_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    out_len: *mut usize,
) -> *mut u8 {
    match (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            let bytes = engine.get_projection_with_codec(codec)?;
            let (pointer, len) = bytes_into_raw(bytes);
            write_output_len(out_len, len)?;
            Ok(pointer)
        })
    })() {
        Ok(value) => value,
        Err(error) => {
            let _ = with_engine_mut(engine, |engine| Ok(engine.set_error(error)));
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_save_state_json(engine: *mut UiGridAbiEngine) -> *mut c_char {
    match with_engine_mut(engine, |engine| {
        engine.clear_error();
        engine.save_state_json()
    }) {
        Ok(value) => value,
        Err(error) => {
            let _ = with_engine_mut(engine, |engine| Ok(engine.set_error(error)));
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_save_state_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    out_len: *mut usize,
) -> *mut u8 {
    match (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            let bytes = engine.save_state_with_codec(codec)?;
            let (pointer, len) = bytes_into_raw(bytes);
            write_output_len(out_len, len)?;
            Ok(pointer)
        })
    })() {
        Ok(value) => value,
        Err(error) => {
            let _ = with_engine_mut(engine, |engine| Ok(engine.set_error(error)));
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_restore_state_json(
    engine: *mut UiGridAbiEngine,
    state_json: *const c_char,
) -> bool {
    let result = (|| {
        let state_json = parse_json_input(state_json)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.restore_state_json(&state_json)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_restore_state_bytes(
    engine: *mut UiGridAbiEngine,
    codec: u32,
    state_bytes: *const u8,
    state_len: usize,
) -> bool {
    let result = (|| {
        let codec = UiGridAbiCodec::try_from(codec)?;
        let state_bytes = parse_bytes_input(state_bytes, state_len)?;
        with_engine_mut(engine, |engine| {
            engine.clear_error();
            engine.restore_state_with_codec(codec, state_bytes)
        })
    })();

    match result {
        Ok(()) => true,
        Err(error) => {
            with_engine_mut(engine, |engine| Ok(engine.set_error(error))).unwrap_or(false)
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ui_grid_engine_last_error_message(engine: *mut UiGridAbiEngine) -> *mut c_char {
    match with_engine_mut(engine, |engine| Ok(engine.last_error_message())) {
        Ok(Some(value)) => value,
        _ => std::ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `value` must be either null or a pointer previously returned by one of this
/// library's string-returning functions, and it must not be freed more than once.
pub unsafe extern "C" fn ui_grid_string_free(value: *mut c_char) {
    if value.is_null() {
        return;
    }

    unsafe {
        drop(CString::from_raw(value));
    }
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `value` must be either null or a pointer previously returned by one of this
/// library's byte-buffer functions together with the exact `len` returned for it.
pub unsafe extern "C" fn ui_grid_buffer_free(value: *mut u8, len: usize) {
    if value.is_null() {
        return;
    }

    unsafe {
        drop(Vec::from_raw_parts(value, len, len));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ui_grid_contracts::{
        UiGridColumnOrderCommand, UiGridGroupingCommand, UiGridPinnedColumnsCommand,
        UiGridSortCommand,
    };

    fn read_c_string(pointer: *mut c_char) -> String {
        assert!(!pointer.is_null(), "expected a non-null string pointer");
        let value = unsafe { CString::from_raw(pointer) };
        value.into_string().expect("string should be valid UTF-8")
    }

    fn read_buffer(pointer: *mut u8, len: usize) -> Vec<u8> {
        assert!(!pointer.is_null(), "expected a non-null buffer pointer");
        let bytes = unsafe { slice::from_raw_parts(pointer, len) }.to_vec();
        unsafe { ui_grid_buffer_free(pointer, len) };
        bytes
    }

    fn normalize_projection_fixture(value: &mut Value) {
        if let Some(pipeline_ms) = value.pointer_mut("/payload/pipeline/pipelineMs") {
            *pipeline_ms = Value::from(0.0);
        }
    }

    fn normalized_projection_value(value: &UiGridProjectionEnvelope<UiGridProjection>) -> Value {
        let mut value = serde_json::to_value(value).expect("projection should serialize");
        normalize_projection_fixture(&mut value);
        value
    }

    #[test]
    fn engine_round_trips_projection_and_state() {
        let mut engine = UiGridAbiEngine::new();
        engine
            .set_options_json(
                r#"{"id":"ffi-grid","data":[{"id":"row-1","name":"Alice"}],"columnDefs":[{"name":"name"}],"enableSorting":true}"#,
            )
            .expect("options should parse");
        engine
            .apply_command(UiGridEngineCommand::SetFilter {
                column_name: "name".to_string(),
                value: "Ali".to_string(),
            })
            .expect("command should parse");
        engine
            .apply_command(UiGridEngineCommand::SetSort {
                sort: UiGridSortCommand {
                    column_name: Some("name".to_string()),
                    direction: "asc".to_string(),
                },
            })
            .expect("sort command should parse");
        engine
            .apply_command(UiGridEngineCommand::SetGrouping {
                grouping: UiGridGroupingCommand {
                    group_by: vec!["name".to_string()],
                },
            })
            .expect("grouping command should parse");
        engine
            .apply_command(UiGridEngineCommand::SetPinnedColumns {
                pinning: UiGridPinnedColumnsCommand {
                    pinned_columns: BTreeMap::from([("name".to_string(), "left".to_string())]),
                },
            })
            .expect("pinning command should parse");
        engine
            .apply_command(UiGridEngineCommand::SetColumnOrder {
                order: UiGridColumnOrderCommand {
                    column_order: vec!["name".to_string()],
                },
            })
            .expect("column-order command should parse");

        let projection = engine.get_projection();
        assert_eq!(projection.payload.options.id, "ffi-grid");
        assert_eq!(projection.payload.pipeline.visible_rows.len(), 1);
        assert_eq!(
            projection.payload.sort_state.column_name.as_deref(),
            Some("name")
        );
        assert_eq!(
            projection.payload.group_by_columns,
            vec!["name".to_string()]
        );
        assert_eq!(
            projection.payload.pinned_columns.get("name"),
            Some(&"left".to_string())
        );
        assert_eq!(projection.payload.visible_columns[0].name, "name");

        let saved_state = unsafe {
            CString::from_raw(
                engine
                    .save_state_json()
                    .expect("save state should serialize"),
            )
        };
        let saved_state = saved_state.into_string().expect("state should be utf-8");
        let mut restored = UiGridAbiEngine::new();
        restored
            .set_options_json(
                r#"{"id":"ffi-grid","data":[{"id":"row-1","name":"Alice"}],"columnDefs":[{"name":"name"}],"enableSorting":true}"#,
            )
            .expect("options should parse");
        restored
            .restore_state_json(&saved_state)
            .expect("state should restore");
        assert_eq!(
            restored.active_filters.get("name"),
            Some(&"Ali".to_string())
        );

        let fixture: Value =
            serde_json::from_str(include_str!("../fixtures/projection-envelope-v0.1.0.json"))
                .expect("fixture JSON should parse");
        let actual = normalized_projection_value(&projection);
        assert_eq!(actual, fixture);
    }

    #[test]
    fn ffi_json_codec_bytes_surface_round_trips() {
        let engine = ui_grid_engine_create();
        let options = br#"{"id":"ffi-grid","data":[{"id":"row-1","name":"Alice"}],"columnDefs":[{"name":"name"}],"enableSorting":true}"#;
        assert!(ui_grid_engine_set_options_bytes(
            engine,
            UiGridAbiCodec::Json as u32,
            options.as_ptr(),
            options.len()
        ));

        let command = br#"{"kind":"setSort","columnName":"name","direction":"asc"}"#;
        assert!(ui_grid_engine_apply_command_bytes(
            engine,
            UiGridAbiCodec::Json as u32,
            command.as_ptr(),
            command.len()
        ));

        let mut projection_len = 0;
        let projection = read_buffer(
            ui_grid_engine_get_projection_bytes(
                engine,
                UiGridAbiCodec::Json as u32,
                &mut projection_len,
            ),
            projection_len,
        );
        let projection: Value =
            serde_json::from_slice(&projection).expect("projection should parse");
        assert_eq!(
            projection["payload"]["sortState"]["direction"],
            Value::from("asc")
        );

        let mut state_len = 0;
        let saved_state = read_buffer(
            ui_grid_engine_save_state_bytes(engine, UiGridAbiCodec::Json as u32, &mut state_len),
            state_len,
        );
        assert!(ui_grid_engine_restore_state_bytes(
            engine,
            UiGridAbiCodec::Json as u32,
            saved_state.as_ptr(),
            saved_state.len()
        ));

        unsafe { ui_grid_engine_destroy(engine) };
    }

    #[test]
    fn abi_conformance_matches_json_and_messagepack_projection_payloads() {
        let mut engine = UiGridAbiEngine::new();
        engine
            .set_options_json(
                r#"{"id":"ffi-grid","data":[{"id":"row-1","name":"Alice"}],"columnDefs":[{"name":"name"}],"enableSorting":true}"#,
            )
            .expect("options should parse");
        engine
            .apply_command(UiGridEngineCommand::SetFilter {
                column_name: "name".to_string(),
                value: "Ali".to_string(),
            })
            .expect("filter command should parse");
        engine
            .apply_command(UiGridEngineCommand::SetSort {
                sort: UiGridSortCommand {
                    column_name: Some("name".to_string()),
                    direction: "asc".to_string(),
                },
            })
            .expect("sort command should parse");

        let json_projection: UiGridProjectionEnvelope<UiGridProjection> = serde_json::from_slice(
            &engine
                .get_projection_with_codec(UiGridAbiCodec::Json)
                .expect("json projection should serialize"),
        )
        .expect("json projection should deserialize");
        let messagepack_projection: UiGridProjectionEnvelope<UiGridProjection> =
            rmp_serde::from_slice(
                &engine
                    .get_projection_with_codec(UiGridAbiCodec::MessagePack)
                    .expect("messagepack projection should serialize"),
            )
            .expect("messagepack projection should deserialize");

        assert_eq!(
            normalized_projection_value(&json_projection),
            normalized_projection_value(&messagepack_projection)
        );
    }

    #[test]
    fn ffi_reports_unsupported_codec() {
        let engine = ui_grid_engine_create();
        let options = br#"{}"#;

        let success =
            ui_grid_engine_set_options_bytes(engine, 999, options.as_ptr(), options.len());
        assert!(!success, "unsupported codec should fail");

        let error = read_c_string(ui_grid_engine_last_error_message(engine));
        assert!(error.contains("unsupported ui-grid ABI codec"));

        unsafe { ui_grid_engine_destroy(engine) };
    }

    #[test]
    fn ffi_reports_invalid_options_json() {
        let engine = ui_grid_engine_create();
        let invalid = CString::new("{not-json}").expect("cstring should build");

        let success = ui_grid_engine_set_options_json(engine, invalid.as_ptr());
        assert!(!success, "invalid options JSON should fail");

        let error = read_c_string(ui_grid_engine_last_error_message(engine));
        assert!(error.contains("failed to parse options JSON"));

        unsafe { ui_grid_engine_destroy(engine) };
    }

    #[test]
    fn ffi_reports_invalid_sort_direction() {
        let engine = ui_grid_engine_create();
        let options = CString::new(
            r#"{"id":"ffi-grid","data":[{"id":"row-1","name":"Alice"}],"columnDefs":[{"name":"name"}],"enableSorting":true}"#,
        )
        .expect("cstring should build");
        assert!(ui_grid_engine_set_options_json(engine, options.as_ptr()));

        let invalid_command =
            CString::new(r#"{"kind":"setSort","columnName":"name","direction":"sideways"}"#)
                .expect("cstring should build");
        let success = ui_grid_engine_apply_command_json(engine, invalid_command.as_ptr());
        assert!(!success, "invalid sort direction should fail");

        let error = read_c_string(ui_grid_engine_last_error_message(engine));
        assert!(error.contains("unsupported sort direction"));

        unsafe { ui_grid_engine_destroy(engine) };
    }

    #[test]
    fn ffi_reports_invalid_state_json() {
        let engine = ui_grid_engine_create();
        let invalid = CString::new("{").expect("cstring should build");

        let success = ui_grid_engine_restore_state_json(engine, invalid.as_ptr());
        assert!(!success, "invalid state JSON should fail");

        let error = read_c_string(ui_grid_engine_last_error_message(engine));
        assert!(error.contains("failed to parse state JSON"));

        unsafe { ui_grid_engine_destroy(engine) };
    }
}
