import { GridColumnDef, GridHeaderTemplateContext, GridOptions, GridRow } from './grid.models';
import { titleize, toCsvValue } from './grid.utils';
import { buildGridCellContext, formatGridCellDisplayValue } from './grid.core.display';

export function headerLabel(column: GridColumnDef): string {
  return column.displayName ?? titleize(column.name);
}

export function buildGridHeaderContext(column: GridColumnDef): GridHeaderTemplateContext {
  const value = headerLabel(column);
  return {
    $implicit: value,
    value,
    column,
  };
}

export function formatGridHeaderDisplayValue(context: GridHeaderTemplateContext): string {
  return context.column.headerRenderer ? context.column.headerRenderer(context) : context.value;
}

/** Which rows the exporter should include. Mirrors the old grid's
 * `rowTypes` argument on `gridApi.exporter.csvExport` / `pdfExport`:
 * - `all`: every row in the original data (pre-filter, pre-paging).
 * - `visible`: rows currently visible in the pipeline (post-filter + page).
 * - `selected`: rows currently selected. */
export type GridExporterRowType = 'all' | 'visible' | 'selected';

/** Which columns the exporter should include. Mirrors the old grid's
 * `colTypes` argument:
 * - `all`: every column, including hidden ones.
 * - `visible`: columns currently rendered in the grid. */
export type GridExporterColumnType = 'all' | 'visible';

export const GRID_EXPORTER_CONSTANTS = Object.freeze({
  featureName: 'exporter',
  rowHeaderColName: 'treeBaseRowHeaderCol',
  selectionRowHeaderColName: 'selectionRowHeaderCol',
  ALL: 'all',
  VISIBLE: 'visible',
  SELECTED: 'selected',
  CSV_CONTENT: 'CSV_CONTENT',
  BUTTON_LABEL: 'BUTTON_LABEL',
  FILE_NAME: 'FILE_NAME',
} as const);

const AUTO_SUPPRESSED_COLUMNS: ReadonlySet<string> = new Set<string>([
  GRID_EXPORTER_CONSTANTS.selectionRowHeaderColName,
  GRID_EXPORTER_CONSTANTS.rowHeaderColName,
]);

/** Full option matrix for the exporter. Field-for-field parity with the
 * old `ui.grid.exporter` options.
 *
 * `fieldCallback` / `fieldFormatCallback` mirror `exporterFieldCallback` /
 * `exporterFieldFormatCallback` — the former returns a different value, the
 * latter returns a format string that wraps each cell. `suppressColumns`
 * mirrors `exporterSuppressColumns`. `allDataFn` is the supplier called when
 * `rowType === 'all'` needs more data than the grid has in memory.
 * `headerFilterUseName` swaps header labels for display names when true
 * (ui-grid used column.name instead when false).
 * `headerFilter` is the final name transformer applied after all other
 * header logic — equivalent to `exporterHeaderFilter` in the old module. */
export interface GridExporterOptions {
  readonly csvColumnSeparator?: string;
  readonly csvFilename?: string | ((rowType: GridExporterRowType, colType: GridExporterColumnType) => string);
  readonly headerFilterUseName?: boolean;
  readonly headerFilter?: (displayName: string, column: GridColumnDef) => string;
  readonly headerTemplate?: string;
  readonly showHeader?: boolean;
  readonly fieldCallback?: (row: GridRow, column: GridColumnDef, value: unknown) => unknown;
  readonly fieldFormatCallback?: (
    row: GridRow,
    column: GridColumnDef,
    value: unknown,
  ) => string | undefined | null;
  readonly fieldApplyFilters?: boolean;
  readonly suppressColumns?: readonly string[];
  readonly olderExcelCompatibility?: boolean;
  readonly isExcelCompatible?: boolean;
  readonly allDataFn?: () => readonly GridRow[] | Promise<readonly GridRow[]>;
  readonly excelFilename?: string;
  readonly excelSheetName?: string;
  readonly csvLinkElement?: HTMLElement | null;
  readonly menuItemOrder?: number;
  readonly menuCsv?: boolean;
  readonly menuAllData?: boolean;
  readonly menuVisibleData?: boolean;
  readonly menuSelectedData?: boolean;
  readonly suppressMenu?: boolean;
  readonly menuLabel?: string;
}

const UTF8_BOM = '﻿';

function resolveHeader(
  column: GridColumnDef,
  options: GridExporterOptions | undefined,
): string {
  const raw = options?.headerFilterUseName === true
    ? column.name
    : (column.displayName ?? titleize(column.name));
  if (options?.headerFilter) {
    return options.headerFilter(raw, column);
  }
  return raw;
}

/** Determine which columns the exporter should emit. Mirrors the old grid's
 * `getColumnHeaders` + `getData` column logic — it auto-suppresses the
 * selection / tree row-header columns and honours `exporterSuppressExport`
 * / `exporterSuppressColumns` (column-def flag and grid-option list). */
export function filterExporterColumns(
  columns: readonly GridColumnDef[],
  options: GridExporterOptions | undefined,
  colType: GridExporterColumnType,
): GridColumnDef[] {
  const suppressed = new Set(options?.suppressColumns ?? []);
  return columns.filter((column) => {
    if (AUTO_SUPPRESSED_COLUMNS.has(column.name)) return false;
    if (suppressed.has(column.name)) return false;
    if (column.exporterSuppressExport === true) return false;
    if (colType === 'all') return true;
    return column.visible !== false;
  });
}

function cellValueForExport(
  row: GridRow,
  column: GridColumnDef,
  options: GridExporterOptions | undefined,
): string {
  const rawValue = formatGridCellDisplayValue(buildGridCellContext(row, column));
  // The old exporter lets consumers override the raw value (pre-format)
  // via fieldCallback, and then optionally transform the final string via
  // fieldFormatCallback. When fieldCallback runs the return value replaces
  // the cell, but the formatter still runs on the display string.
  let value: string = rawValue;
  if (options?.fieldCallback) {
    const override = options.fieldCallback(row, column, rawValue);
    if (override !== undefined && override !== null) {
      value = typeof override === 'string' ? override : String(override);
    }
  }
  if (options?.fieldFormatCallback) {
    const format = options.fieldFormatCallback(row, column, value);
    if (format !== undefined && format !== null) {
      value = format;
    }
  }
  return value;
}

/** Resolve the output filename. Mirrors the old grid's handling of
 * `exporterCsvFilename` / `exporterExcelFilename` as either a string or a
 * function `(grid, rowType, colType) => string`. */
export function resolveExporterFilename(
  filename: string | ((rowType: GridExporterRowType, colType: GridExporterColumnType) => string) | undefined,
  fallback: string,
  rowType: GridExporterRowType,
  colType: GridExporterColumnType,
): string {
  if (typeof filename === 'function') return filename(rowType, colType);
  if (typeof filename === 'string' && filename.length > 0) return filename;
  return fallback;
}

/** Legacy entry point — kept for backwards compatibility with earlier
 * callers. New callers should prefer `buildGridCsv`. */
export function exportCsvRows(
  columns: readonly GridColumnDef[],
  rows: readonly GridRow[],
  formatCell?: (row: GridRow, column: GridColumnDef) => string,
): string {
  const header = columns.map((column) => toCsvValue(headerLabel(column))).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) =>
        toCsvValue(
          formatCell
            ? formatCell(row, column)
            : formatGridCellDisplayValue(buildGridCellContext(row, column)),
        ),
      )
      .join(','),
  );
  return [header, ...body].join('\n');
}

/** Build a CSV string from the given columns + rows, honoring the full
 * exporter option matrix. Ports `ui.grid.exporter.service#formatAsCsv` and
 * related helpers. */
export function buildGridCsv(
  columns: readonly GridColumnDef[],
  rows: readonly GridRow[],
  options: GridExporterOptions = {},
  colType: GridExporterColumnType = 'visible',
): string {
  const sep = options.csvColumnSeparator ?? ',';
  const effectiveColumns = filterExporterColumns(columns, options, colType);

  // Skip any row flagged as non-exportable. Mirrors old grid's
  // `exporterEnableExporting` row-level flag.
  const exportableRows = rows.filter((row) => row.exporterEnableExporting !== false);

  const showHeader = options.showHeader !== false;
  const headerCells = effectiveColumns
    .map((column) => toCsvValue(resolveHeader(column, options), sep))
    .join(sep);
  const headerTemplate = options.headerTemplate;
  const header = !showHeader
    ? ''
    : headerTemplate
      ? headerTemplate.replace('HEADER_VALUES', headerCells)
      : headerCells;

  const body = exportableRows.map((row) =>
    effectiveColumns
      .map((column) => toCsvValue(cellValueForExport(row, column, options), sep))
      .join(sep),
  );

  const lines = showHeader ? [header, ...body] : body;
  const csv = lines.join('\n');
  return options.olderExcelCompatibility ? UTF8_BOM + csv : csv;
}

/** Translate a `GridOptions` object into the exporter's option matrix.
 * Each option field maps 1:1 from `exporter*` to the stripped name used
 * internally, matching the shape of the old `ui.grid.exporter` module. */
export function resolveGridExporterOptions(options: GridOptions): GridExporterOptions {
  return {
    csvColumnSeparator: options.exporterCsvColumnSeparator,
    csvFilename: options.exporterCsvFilename,
    headerFilterUseName: options.exporterHeaderFilterUseName,
    headerFilter: options.exporterHeaderFilter,
    headerTemplate: options.exporterHeaderTemplate,
    fieldCallback: options.exporterFieldCallback,
    fieldFormatCallback: options.exporterFieldFormatCallback,
    fieldApplyFilters: options.exporterFieldApplyFilters,
    suppressColumns: options.exporterSuppressColumns,
    olderExcelCompatibility: options.exporterOlderExcelCompatibility,
    isExcelCompatible: options.exporterIsExcelCompatible,
    allDataFn: options.exporterAllDataFn,
    excelFilename: options.exporterExcelFilename,
    excelSheetName: options.exporterExcelSheetName,
    csvLinkElement: options.exporterCsvLinkElement,
    menuItemOrder: options.exporterMenuItemOrder,
    menuCsv: options.exporterMenuCsv,
    menuAllData: options.exporterMenuAllData,
    menuVisibleData: options.exporterMenuVisibleData,
    menuSelectedData: options.exporterMenuSelectedData,
    suppressMenu: options.exporterSuppressMenu,
    menuLabel: options.exporterMenuLabel,
    showHeader: options.exporterShowHeader,
  };
}
