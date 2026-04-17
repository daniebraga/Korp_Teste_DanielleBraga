import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'produtos' },
  {
    path: 'produtos',
    loadComponent: () =>
      import('./pages/products-page/products-page.component').then((m) => m.ProductsPageComponent)
  },
  {
    path: 'notas',
    loadComponent: () =>
      import('./pages/invoices-page/invoices-page.component').then((m) => m.InvoicesPageComponent)
  },
  {
    path: 'notas/:id',
    loadComponent: () =>
      import('./pages/invoice-detail-page/invoice-detail-page.component').then(
        (m) => m.InvoiceDetailPageComponent
      )
  },
  { path: '**', redirectTo: 'produtos' }
];
