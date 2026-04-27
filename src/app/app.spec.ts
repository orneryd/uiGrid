import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the modernized grid heading', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const gridHost = compiled.querySelector('app-ui-grid') as HTMLElement | null;
    const heading = gridHost?.shadowRoot?.querySelector('h1');
    expect(heading?.textContent).toContain('UI Grid Modernized');
  });

  it('should register the grid api and expose the configured column behaviors', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const app = fixture.componentInstance as unknown as {
      gridApi: () => unknown;
      options: () => {
        columnDefs: Array<{
          name: string;
          field?: string;
          displayName?: string;
          cellTemplate?: unknown;
          formatter?: (value: unknown) => string;
        }>;
      };
    };
    const options = app.options();
    const statusColumn = options.columnDefs.find((column) => column.name === 'status');
    const renewalColumn = options.columnDefs.find((column) => column.name === 'renewalDate');
    const ownerColumn = options.columnDefs.find((column) => column.name === 'owner');

    expect(app.gridApi()).toBeTruthy();
    expect(statusColumn?.cellTemplate).toBeTruthy();
    expect(renewalColumn?.displayName).toBe('Renewal');
    expect(renewalColumn?.formatter?.('2026-04-02')).toBe(new Date('2026-04-02').toLocaleDateString('en-US'));
    expect(ownerColumn?.field).toBe('account.owner');
  });

  it('should support spreadsheet-style editing through the demo app grid', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const app = fixture.componentInstance as unknown as {
      gridApi: () => {
        core: { clearGrouping: () => void; getVisibleRows: () => Array<{ entity: Record<string, unknown> }> };
      } | null;
    };
    const gridApi = app.gridApi()!;
    gridApi.core.clearGrouping();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const gridHost = compiled.querySelector('app-ui-grid') as HTMLElement;
    const shadowRoot = gridHost.shadowRoot!;
    const firstNameCell = shadowRoot.querySelector('.body-cell[data-col-name="name"]') as HTMLElement;

    firstNameCell.focus();
    fixture.detectChanges();
    await fixture.whenStable();

    const firstEditor = shadowRoot.querySelector('.cell-editor[data-col-name="name"]') as HTMLInputElement;
    expect(firstEditor.value).toBe('Customer 1');

    firstEditor.value = 'Customer Prime';
    firstEditor.dispatchEvent(new Event('input'));
    firstEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gridApi.core.getVisibleRows()[0]?.entity['name']).toBe('Customer Prime');
    const companyEditor = shadowRoot.querySelector('.cell-editor[data-col-name="company"]') as HTMLInputElement;
    expect(companyEditor).toBeTruthy();
    expect(companyEditor.value).toBe('Northwind');

    companyEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(shadowRoot.querySelector('.cell-editor[data-col-name="company"]')).toBeNull();
    const revenueCell = shadowRoot.querySelector('.body-cell[data-col-name="revenue"]') as HTMLElement;
    expect(revenueCell).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(revenueCell);
    expect(shadowRoot.querySelector('.cell-editor[data-col-name="revenue"]')).toBeNull();
  });
});
