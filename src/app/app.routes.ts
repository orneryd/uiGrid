import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'docs', loadComponent: () => import('./pages/docs/docs-layout.component').then((m) => m.DocsLayoutComponent) },
  {
    path: 'docs/:topic',
    loadComponent: () => import('./pages/docs/docs-layout.component').then((m) => m.DocsLayoutComponent)
  },
  {
    path: 'themes',
    loadComponent: () => import('./pages/themes/themes.component').then((m) => m.ThemesComponent)
  },
  { path: '**', redirectTo: 'home' }
];
