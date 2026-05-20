//! Vendor-agnostic grid exporter registry.
//!
//! The TS / vanilla / Angular / React surface keeps its existing
//! `gridApi.core.exportPdf` / pdfMake / xlsx code paths — this module
//! exists for the Rust side, where there's no pdfMake equivalent and
//! native hosts (egui demo, future LVGL adapter, downstream embedders)
//! need a way to plug their own document-generation crate in.
//!
//! Built-in CSV is auto-registered through [`init_default_grid_exporters`]
//! so `export_grid("csv", &ctx)` works without any setup. Consumers can
//! register additional exporters (`register_grid_exporter("pdf", ...)`)
//! and unregister them again. The registry is process-wide and
//! thread-safe.
//!
//! Storage uses a `OnceLock<RwLock<HashMap<String, Arc<dyn GridExporter>>>>`
//! so the first call lazily initialises the map and subsequent calls
//! pay only the cost of the read lock. `Arc` lets the exporter outlive
//! a brief read to invoke it, even if another thread unregisters
//! concurrently.

use std::collections::HashMap;
use std::sync::{Arc, OnceLock, RwLock};

use crate::{
    export::{GridExportPayload, build_csv_export_payload},
    models::{GridColumnDef, GridOptions, GridRecord, GridRow},
};

/// Which rows the exporter should process.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum GridExportScope {
    /// Default — post-filter, post-sort, post-paginate rows.
    #[default]
    Visible,
    /// Every row in `options.data` regardless of pipeline state.
    All,
    /// Currently-selected rows only (resolved through `pipeline.visible_rows`).
    Selected,
}

/// Context handed to a registered exporter. Carries the resolved
/// columns + rows for the requested scope, the consumer's options,
/// the originating format string, and pre-formatted cell text in
/// row-major order so the exporter doesn't have to re-walk
/// `formatGridCellDisplayValue` itself.
pub struct GridRegisteredExportContext<'a> {
    pub columns: &'a [GridColumnDef],
    pub rows: &'a [GridRow],
    pub formatted_cells: Vec<Vec<String>>,
    pub options: &'a GridOptions,
    pub scope: GridExportScope,
    /// The format string the caller invoked `export_grid` with — useful
    /// for exporters that route multiple subformats through one
    /// implementation (e.g. an `excel` exporter that branches on
    /// `xlsx` vs `xls`).
    pub format: &'a str,
}

/// Result of an export operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GridExportResult {
    pub filename: String,
    pub content: Vec<u8>,
    pub mime_type: String,
}

impl From<GridExportPayload> for GridExportResult {
    fn from(payload: GridExportPayload) -> Self {
        Self {
            filename: payload.filename,
            content: payload.contents.into_bytes(),
            mime_type: payload.mime_type,
        }
    }
}

/// Trait every registered exporter implements. Consumers implement it
/// on their own zero-sized struct; the registry stores `Arc<dyn …>`
/// so trait objects can be cheaply cloned out for invocation.
pub trait GridExporter: Send + Sync {
    fn export(&self, ctx: &GridRegisteredExportContext<'_>) -> GridExportResult;
}

/// Auto-blanket impl for plain function pointers / closures so consumers
/// can register without naming a struct.
impl<F> GridExporter for F
where
    F: Fn(&GridRegisteredExportContext<'_>) -> GridExportResult + Send + Sync,
{
    fn export(&self, ctx: &GridRegisteredExportContext<'_>) -> GridExportResult {
        (self)(ctx)
    }
}

type ExporterMap = HashMap<String, Arc<dyn GridExporter>>;

fn registry() -> &'static RwLock<ExporterMap> {
    static REGISTRY: OnceLock<RwLock<ExporterMap>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut map: ExporterMap = HashMap::new();
        map.insert(
            "csv".to_string(),
            Arc::new(BuiltInCsvExporter) as Arc<dyn GridExporter>,
        );
        RwLock::new(map)
    })
}

/// Idempotent — the registry initialises the built-in CSV exporter on
/// first access. Calling this explicitly is a way for hosts to pre-warm
/// the registry (e.g. before a benchmark loop) without going through a
/// regular `register_grid_exporter` call.
pub fn init_default_grid_exporters() {
    let _ = registry();
}

/// Register an exporter for `format`. Replaces any prior registration
/// under the same key; consumers that want to compose around the
/// built-in CSV implementation should read it first via
/// [`get_grid_exporter`] and call through to it from their replacement.
pub fn register_grid_exporter(format: impl Into<String>, exporter: Arc<dyn GridExporter>) {
    let mut map = registry()
        .write()
        .expect("ui_grid_core::exporter_registry write lock poisoned");
    map.insert(format.into(), exporter);
}

/// Drop the exporter registered under `format`. Returns the previous
/// registration, if any.
pub fn unregister_grid_exporter(format: &str) -> Option<Arc<dyn GridExporter>> {
    let mut map = registry()
        .write()
        .expect("ui_grid_core::exporter_registry write lock poisoned");
    map.remove(format)
}

/// Look up the exporter registered under `format` without invoking it.
/// Useful for consumers that want to compose around an existing
/// implementation.
pub fn get_grid_exporter(format: &str) -> Option<Arc<dyn GridExporter>> {
    let map = registry()
        .read()
        .expect("ui_grid_core::exporter_registry read lock poisoned");
    map.get(format).cloned()
}

/// Error surfaced from [`export_grid`] when no exporter is registered
/// for the requested format.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnknownExportFormat {
    pub format: String,
}

impl std::fmt::Display for UnknownExportFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "no exporter registered for format `{}`", self.format)
    }
}

impl std::error::Error for UnknownExportFormat {}

/// Invoke the exporter registered for `format` against `ctx`. Returns
/// [`UnknownExportFormat`] if nothing was registered.
pub fn export_grid(
    format: &str,
    ctx: &GridRegisteredExportContext<'_>,
) -> Result<GridExportResult, UnknownExportFormat> {
    let exporter = get_grid_exporter(format).ok_or_else(|| UnknownExportFormat {
        format: format.to_string(),
    })?;
    Ok(exporter.export(ctx))
}

/// Convenience: pull `GridRecord` rows out of the registered context
/// (mirrors what TS does in its CSV exporter when it walks
/// `pipeline.visible_rows.entity`). Useful for consumer exporters that
/// would rather work with raw entities than `GridRow`.
pub fn entities_from_export_context(ctx: &GridRegisteredExportContext<'_>) -> Vec<GridRecord> {
    ctx.rows.iter().map(|row| row.entity.clone()).collect()
}

/// Built-in CSV exporter — delegates to [`build_csv_export_payload`]
/// so the existing TS-faithful code path keeps producing identical
/// bytes.
struct BuiltInCsvExporter;

impl GridExporter for BuiltInCsvExporter {
    fn export(&self, ctx: &GridRegisteredExportContext<'_>) -> GridExportResult {
        let core_ctx = crate::export::GridExportContext {
            grid_id: &ctx.options.id,
            columns: ctx.columns,
            rows: ctx.rows,
        };
        let payload: GridExportPayload = build_csv_export_payload(&core_ctx);
        GridExportResult {
            filename: payload.filename,
            content: payload.contents.into_bytes(),
            mime_type: payload.mime_type,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_options() -> GridOptions {
        GridOptions {
            id: "registry-grid".to_string(),
            ..GridOptions::default()
        }
    }

    fn make_row(id: &str, value: &str) -> GridRow {
        GridRow::new(id.to_string(), json!({ "id": id, "name": value }), 0, 44)
    }

    fn make_columns() -> Vec<GridColumnDef> {
        vec![GridColumnDef {
            name: "name".to_string(),
            ..GridColumnDef::default()
        }]
    }

    #[test]
    fn built_in_csv_exporter_is_registered_by_default() {
        init_default_grid_exporters();
        assert!(get_grid_exporter("csv").is_some());
    }

    #[test]
    fn export_grid_invokes_registered_exporter() {
        init_default_grid_exporters();
        let columns = make_columns();
        let rows = vec![make_row("r1", "Alpha")];
        let formatted = vec![vec!["Alpha".to_string()]];
        let options = make_options();
        let ctx = GridRegisteredExportContext {
            columns: &columns,
            rows: &rows,
            formatted_cells: formatted,
            options: &options,
            scope: GridExportScope::Visible,
            format: "csv",
        };
        let result = export_grid("csv", &ctx).expect("csv exporter must be registered");
        assert_eq!(result.mime_type, "text/csv;charset=utf-8");
        assert!(!result.content.is_empty());
        // Header is the titleized column name, body contains the row's
        // formatted display value.
        let text = String::from_utf8(result.content).expect("csv is utf-8");
        assert!(text.contains("Name"));
        assert!(text.contains("Alpha"));
    }

    #[test]
    fn export_grid_returns_unknown_format_error() {
        init_default_grid_exporters();
        let columns = make_columns();
        let rows: Vec<GridRow> = Vec::new();
        let options = make_options();
        let ctx = GridRegisteredExportContext {
            columns: &columns,
            rows: &rows,
            formatted_cells: Vec::new(),
            options: &options,
            scope: GridExportScope::Visible,
            format: "tsv",
        };
        // Use a format that's guaranteed not to be registered. We
        // unregister first in case a prior test left a registration.
        unregister_grid_exporter("tsv");
        let err = export_grid("tsv", &ctx).expect_err("tsv must not be registered");
        assert_eq!(err.format, "tsv");
        assert!(err.to_string().contains("tsv"));
    }

    #[test]
    fn export_grid_passes_scope_through_to_exporter() {
        // Capture the (scope, format, row_count) the exporter sees so
        // we can assert the registry plumbing is wire-faithful. Uses a
        // Mutex-stashed last-call slot since the trait object can't
        // mutably capture across calls.
        use std::sync::Mutex;
        static CAPTURED: Mutex<Option<(GridExportScope, String, usize)>> = Mutex::new(None);
        register_grid_exporter(
            "scope-snapshot",
            Arc::new(|ctx: &GridRegisteredExportContext<'_>| {
                *CAPTURED.lock().unwrap() =
                    Some((ctx.scope, ctx.format.to_string(), ctx.rows.len()));
                GridExportResult {
                    filename: "snapshot.bin".into(),
                    content: Vec::new(),
                    mime_type: "application/octet-stream".into(),
                }
            }),
        );

        let columns = make_columns();
        let rows = vec![make_row("r1", "a"), make_row("r2", "b")];
        let options = make_options();
        let formatted = vec![vec!["a".to_string()], vec!["b".to_string()]];

        for scope in [
            GridExportScope::Visible,
            GridExportScope::All,
            GridExportScope::Selected,
        ] {
            let ctx = GridRegisteredExportContext {
                columns: &columns,
                rows: &rows,
                formatted_cells: formatted.clone(),
                options: &options,
                scope,
                format: "scope-snapshot",
            };
            export_grid("scope-snapshot", &ctx).unwrap();
            let captured = CAPTURED.lock().unwrap().clone().unwrap();
            assert_eq!(captured.0, scope);
            assert_eq!(captured.1, "scope-snapshot");
            assert_eq!(captured.2, rows.len());
        }
        unregister_grid_exporter("scope-snapshot");
    }

    #[test]
    fn register_replaces_prior_registration_and_unregister_drops_it() {
        let columns = make_columns();
        let rows: Vec<GridRow> = Vec::new();
        let options = make_options();

        register_grid_exporter(
            "snapshot-test",
            Arc::new(|_ctx: &GridRegisteredExportContext<'_>| GridExportResult {
                filename: "first.bin".into(),
                content: b"first".to_vec(),
                mime_type: "application/octet-stream".into(),
            }),
        );
        let ctx = GridRegisteredExportContext {
            columns: &columns,
            rows: &rows,
            formatted_cells: Vec::new(),
            options: &options,
            scope: GridExportScope::All,
            format: "snapshot-test",
        };
        let first = export_grid("snapshot-test", &ctx).unwrap();
        assert_eq!(first.filename, "first.bin");

        register_grid_exporter(
            "snapshot-test",
            Arc::new(|_ctx: &GridRegisteredExportContext<'_>| GridExportResult {
                filename: "second.bin".into(),
                content: b"second".to_vec(),
                mime_type: "application/octet-stream".into(),
            }),
        );
        let second = export_grid("snapshot-test", &ctx).unwrap();
        assert_eq!(second.filename, "second.bin");

        let removed = unregister_grid_exporter("snapshot-test");
        assert!(removed.is_some());
        assert!(get_grid_exporter("snapshot-test").is_none());
    }
}
