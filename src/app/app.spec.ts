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
});
