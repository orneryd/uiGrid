use egui::Ui;
use serde_json::Value;
use ui_grid_core::models::{GridColumnDef, GridRow};

use crate::grid_theme::GridTheme;

pub struct GridCellContext<'a> {
    pub value: &'a Value,
    pub row: &'a GridRow,
    pub column: &'a GridColumnDef,
    pub theme: &'a GridTheme,
    pub row_index: usize,
}

type Formatter = Box<dyn Fn(&Value, &GridRow) -> String>;
type CellRenderer = Box<dyn Fn(&mut Ui, &GridCellContext<'_>)>;
type CellEditor = Box<dyn FnMut(&mut Ui, &mut String, &GridTheme) -> bool>;

pub struct EguiColumnExt {
    pub column_name: String,
    pub formatter: Option<Formatter>,
    pub cell_renderer: Option<CellRenderer>,
    pub cell_editor: Option<CellEditor>,
}

impl EguiColumnExt {
    pub fn new(column_name: impl Into<String>) -> Self {
        Self {
            column_name: column_name.into(),
            formatter: None,
            cell_renderer: None,
            cell_editor: None,
        }
    }

    pub fn with_formatter(mut self, f: impl Fn(&Value, &GridRow) -> String + 'static) -> Self {
        self.formatter = Some(Box::new(f));
        self
    }

    pub fn with_cell_renderer(
        mut self,
        f: impl Fn(&mut Ui, &GridCellContext<'_>) + 'static,
    ) -> Self {
        self.cell_renderer = Some(Box::new(f));
        self
    }

    pub fn with_cell_editor(
        mut self,
        f: impl FnMut(&mut Ui, &mut String, &GridTheme) -> bool + 'static,
    ) -> Self {
        self.cell_editor = Some(Box::new(f));
        self
    }
}

pub fn find_column_ext<'a>(
    extensions: &'a [EguiColumnExt],
    column_name: &str,
) -> Option<&'a EguiColumnExt> {
    extensions.iter().find(|e| e.column_name == column_name)
}

pub fn find_column_ext_mut<'a>(
    extensions: &'a mut [EguiColumnExt],
    column_name: &str,
) -> Option<&'a mut EguiColumnExt> {
    extensions.iter_mut().find(|e| e.column_name == column_name)
}
