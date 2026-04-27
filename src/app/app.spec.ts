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
});
