import { describe, expect, it } from 'vitest';
import {
  GRID_EXPORTER_CONSTANTS,
  buildGridCsv,
  filterExporterColumns,
  resolveExporterFilename,
  resolveGridExporterOptions,
} from './grid.core.export';
import { GridColumnDef, GridOptions, GridRow } from './grid.models';

function makeRow(id: string, entity: Record<string, unknown>, index: number): GridRow {
  return new GridRow(id, entity, index, 44);
}

const columns: GridColumnDef[] = [
  { name: 'name', displayName: 'Name' },
  { name: 'status', displayName: 'Status', visible: false },
  { name: 'revenue', displayName: 'Revenue' },
];

const rows: GridRow[] = [
  makeRow('r1', { name: 'Alpha', status: 'Active', revenue: 100 }, 0),
  makeRow('r2', { name: 'Beta, Inc.', status: 'Pilot', revenue: 200 }, 1),
];

describe('buildGridCsv', () => {
  it('exports visible columns by default with display-name headers', () => {
    const csv = buildGridCsv(columns, rows);
    // status is visible:false → filtered out when colType='visible'
    expect(csv.split('\n')).toEqual(['Name,Revenue', 'Alpha,100', '"Beta, Inc.",200']);
  });

  it('includes hidden columns when colType is "all"', () => {
    const csv = buildGridCsv(columns, rows, {}, 'all');
    expect(csv.split('\n')[0]).toBe('Name,Status,Revenue');
  });

  it('uses column.name headers when headerFilterUseName is true', () => {
    const csv = buildGridCsv(columns, rows, { headerFilterUseName: true });
    expect(csv.split('\n')[0]).toBe('name,revenue');
  });

  it('routes headers through headerFilter when provided', () => {
    const csv = buildGridCsv(columns, rows, {
      headerFilter: (header) => header.toUpperCase(),
    });
    expect(csv.split('\n')[0]).toBe('NAME,REVENUE');
  });

  it('honors csvColumnSeparator', () => {
    const csv = buildGridCsv(columns, rows, { csvColumnSeparator: ';' });
    // 'Beta, Inc.' is no longer quoted because the separator is ';', but
    // the semicolon-less cells round-trip without quotes.
    expect(csv.split('\n')).toEqual(['Name;Revenue', 'Alpha;100', 'Beta, Inc.;200']);
  });

  it('suppresses columns listed in suppressColumns', () => {
    const csv = buildGridCsv(columns, rows, { suppressColumns: ['revenue'] }, 'all');
    expect(csv.split('\n')[0]).toBe('Name,Status');
  });

  it('applies fieldCallback to override raw cell values', () => {
    const csv = buildGridCsv(columns, rows, {
      fieldCallback: (_row, column, value) =>
        column.name === 'revenue' ? `$${value}` : value,
    });
    expect(csv.split('\n')[1]).toBe('Alpha,$100');
  });

  it('applies fieldFormatCallback to wrap the final string', () => {
    const csv = buildGridCsv(columns, rows, {
      fieldFormatCallback: (_row, column) =>
        column.name === 'name' ? '[name]' : undefined,
    });
    expect(csv.split('\n')[1]).toBe('[name],100');
  });

  it('prepends BOM when olderExcelCompatibility is true', () => {
    const csv = buildGridCsv(columns, rows, { olderExcelCompatibility: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('substitutes HEADER_VALUES in a custom header template', () => {
    const csv = buildGridCsv(columns, rows, {
      headerTemplate: 'prefix\nHEADER_VALUES\nsuffix',
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('prefix');
    expect(lines[1]).toBe('Name,Revenue');
    expect(lines[2]).toBe('suffix');
    // Body rows follow the rendered header template.
    expect(lines[3]).toBe('Alpha,100');
  });
});

describe('resolveGridExporterOptions', () => {
  it('maps exporter* options to the stripped-name shape', () => {
    const options: GridOptions = {
      id: 'g',
      data: [],
      columnDefs: [],
      exporterCsvColumnSeparator: '\t',
      exporterCsvFilename: 'out.csv',
      exporterHeaderFilterUseName: true,
      exporterSuppressColumns: ['skip'],
      exporterOlderExcelCompatibility: true,
    };
    expect(resolveGridExporterOptions(options)).toMatchObject({
      csvColumnSeparator: '\t',
      csvFilename: 'out.csv',
      headerFilterUseName: true,
      suppressColumns: ['skip'],
      olderExcelCompatibility: true,
    });
  });
});

describe('filterExporterColumns', () => {
  it('auto-suppresses selectionRowHeaderCol and treeBaseRowHeaderCol', () => {
    const cols: GridColumnDef[] = [
      { name: 'selectionRowHeaderCol' },
      { name: 'treeBaseRowHeaderCol' },
      { name: 'name' },
    ];
    expect(filterExporterColumns(cols, {}, 'visible').map((c) => c.name)).toEqual(['name']);
  });

  it('honors exporterSuppressExport on columnDef', () => {
    const cols: GridColumnDef[] = [
      { name: 'a' },
      { name: 'b', exporterSuppressExport: true },
      { name: 'c' },
    ];
    expect(filterExporterColumns(cols, {}, 'visible').map((c) => c.name)).toEqual(['a', 'c']);
  });
});

describe('exporter row-level filtering', () => {
  it('skips rows with exporterEnableExporting:false', () => {
    const r1 = new GridRow('r1', { name: 'A' }, 0, 44);
    const r2 = new GridRow('r2', { name: 'B' }, 1, 44);
    r2.exporterEnableExporting = false;
    const csv = buildGridCsv([{ name: 'name', displayName: 'Name' }], [r1, r2]);
    expect(csv.split('\n').slice(1)).toEqual(['A']);
  });
});

describe('resolveExporterFilename', () => {
  it('returns the fallback when filename is undefined', () => {
    expect(resolveExporterFilename(undefined, 'download.csv', 'visible', 'visible')).toBe(
      'download.csv',
    );
  });

  it('invokes functions with the rowType + colType', () => {
    const fn = resolveExporterFilename(
      (row, col) => `${row}-${col}.csv`,
      'download.csv',
      'selected',
      'all',
    );
    expect(fn).toBe('selected-all.csv');
  });
});

describe('GRID_EXPORTER_CONSTANTS', () => {
  it('exports the same constant names as the old ui.grid.exporter module', () => {
    expect(GRID_EXPORTER_CONSTANTS.ALL).toBe('all');
    expect(GRID_EXPORTER_CONSTANTS.VISIBLE).toBe('visible');
    expect(GRID_EXPORTER_CONSTANTS.SELECTED).toBe('selected');
    expect(GRID_EXPORTER_CONSTANTS.selectionRowHeaderColName).toBe('selectionRowHeaderCol');
  });
});

describe('showHeader:false', () => {
  it('suppresses the header row', () => {
    const r1 = new GridRow('r1', { name: 'A' }, 0, 44);
    const csv = buildGridCsv(
      [{ name: 'name', displayName: 'Name' }],
      [r1],
      { showHeader: false },
    );
    expect(csv).toBe('A');
  });
});
