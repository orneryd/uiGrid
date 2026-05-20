use egui::Ui;
use serde_json::Value;
use ui_grid_core::{
    constants::SortDirection,
    models::{GridColumnDef, GridIcons, GridLabels, GridRow},
    pinning::PinDirection,
};

use crate::grid_theme::GridTheme;

pub struct GridCellContext<'a> {
    pub value: &'a Value,
    pub row: &'a GridRow,
    pub column: &'a GridColumnDef,
    pub theme: &'a GridTheme,
    pub row_index: usize,
}

/// Context passed to a custom filter renderer registered via
/// [`EguiColumnExt::with_filter_renderer`]. The renderer gets the
/// column's current filter term as `&mut String`; mutating it (and
/// returning `true`) signals the grid to re-run the pipeline.
pub struct GridFilterContext<'a> {
    pub column: &'a GridColumnDef,
    pub labels: &'a GridLabels,
    pub theme: &'a GridTheme,
}

pub struct GridHeaderControlsContext<'a> {
    pub column: &'a GridColumnDef,
    pub labels: &'a GridLabels,
    pub icons: &'a GridIcons,
    pub theme: &'a GridTheme,
    pub is_grouped: bool,
    pub sort_direction: SortDirection,
    pub pin_direction: PinDirection,
    pub can_sort: bool,
    pub can_group: bool,
    pub can_pin: bool,
    pub can_move: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EguiHeaderAction {
    ToggleGrouping,
    CycleSort,
    PinLeft,
    PinRight,
    Unpin,
    MoveLeft,
    MoveRight,
}

type Formatter = Box<dyn Fn(&Value, &GridRow) -> String>;
type CellRenderer = Box<dyn Fn(&mut Ui, &GridCellContext<'_>)>;
type CellEditor = Box<dyn FnMut(&mut Ui, &mut String, &GridTheme) -> bool>;
type HeaderControlsRenderer =
    Box<dyn FnMut(&mut Ui, &GridHeaderControlsContext<'_>, &mut Vec<EguiHeaderAction>)>;
/// Returns `true` when the term mutated and the grid should re-run
/// the pipeline. Mirrors the egui idiom of "widget changed".
type FilterRenderer = Box<dyn FnMut(&mut Ui, &GridFilterContext<'_>, &mut String) -> bool>;

pub struct EguiColumnExt {
    pub column_name: String,
    pub formatter: Option<Formatter>,
    pub cell_renderer: Option<CellRenderer>,
    pub cell_editor: Option<CellEditor>,
    pub header_controls_renderer: Option<HeaderControlsRenderer>,
    pub filter_renderer: Option<FilterRenderer>,
}

impl EguiColumnExt {
    pub fn new(column_name: impl Into<String>) -> Self {
        Self {
            column_name: column_name.into(),
            formatter: None,
            cell_renderer: None,
            cell_editor: None,
            header_controls_renderer: None,
            filter_renderer: None,
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

    pub fn with_header_controls_renderer(
        mut self,
        f: impl FnMut(&mut Ui, &GridHeaderControlsContext<'_>, &mut Vec<EguiHeaderAction>) + 'static,
    ) -> Self {
        self.header_controls_renderer = Some(Box::new(f));
        self
    }

    /// Replace the default filter input with a custom renderer. The
    /// closure receives `&mut String` for the column's active filter
    /// term — mutating it and returning `true` causes the grid to
    /// re-run the pipeline. Mirrors the TS `filterRenderer` slot used
    /// by Angular / React adapters.
    pub fn with_filter_renderer(
        mut self,
        f: impl FnMut(&mut Ui, &GridFilterContext<'_>, &mut String) -> bool + 'static,
    ) -> Self {
        self.filter_renderer = Some(Box::new(f));
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
