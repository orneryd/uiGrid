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
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the demo header with repo badges and a repository link', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('.hero-copy h3');
    const repoLink = compiled.querySelector('.repo-link') as HTMLAnchorElement | null;
    const badgeValues = [...compiled.querySelectorAll('.repo-badge strong')].map((node) => node.textContent?.trim());
    const themeHeading = compiled.querySelector('.theme-panel h2');
    const switches = [...compiled.querySelectorAll('.theme-switch')];

    expect(heading?.textContent).toContain('UI Grid');
    expect(repoLink?.getAttribute('href')).toBe('https://github.com/orneryd/uiGrid');
    expect(repoLink?.textContent).toContain('View repository');
    expect(compiled.querySelector('.logo-panel')).toBeNull();
    expect(themeHeading?.textContent).toContain('Studio dark');
    expect(switches).toHaveLength(2);
    expect(badgeValues).toEqual(expect.arrayContaining(['orneryd/uiGrid', '21.2', '@ornery/ui-grid', '90%+']));
  });

  it('should default to dark mode and allow toggling both the color and visual themes', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const [colorSwitch, visualSwitch] = [...host.querySelectorAll('.theme-switch')] as HTMLButtonElement[];

    expect(host.getAttribute('data-color-mode')).toBe('dark');
    expect(host.getAttribute('data-visual-mode')).toBe('default');
    expect(colorSwitch.getAttribute('aria-checked')).toBe('true');
    expect(visualSwitch.getAttribute('aria-checked')).toBe('false');

    colorSwitch.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.getAttribute('data-color-mode')).toBe('light');
    expect(colorSwitch.getAttribute('aria-checked')).toBe('false');

    visualSwitch.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.getAttribute('data-visual-mode')).toBe('wireframe');
    expect(visualSwitch.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.theme-panel h2')?.textContent).toContain('Wireframe light');
  });

  it('should render the modernized grid heading', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
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
