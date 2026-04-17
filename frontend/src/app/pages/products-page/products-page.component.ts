import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import { Product } from '../../models/api.models';
import { StockApiService } from '../../services/stock-api.service';
import { ProductFormDialogComponent, ProductFormDialogData } from './product-form-dialog.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatSnackBarModule, MatIconModule],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent implements OnInit {
  private readonly stock = inject(StockApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns: (keyof Product | 'actions')[] = ['code', 'description', 'balance', 'actions'];
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly deletingProductId = signal<string | null>(null);

  readonly productCount = computed(() => this.products().length);
  readonly stockSum = computed(() => this.products().reduce((sum, p) => sum + Number(p.balance), 0));

  ngOnInit(): void {
    this.refresh();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open<ProductFormDialogComponent, ProductFormDialogData, boolean>(ProductFormDialogComponent, {
      width: 'min(100vw - 2rem, 28rem)',
      maxWidth: '95vw',
      panelClass: 'product-form-dialog-panel',
      data: { mode: 'create' },
      disableClose: false
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.refresh();
      }
    });
  }

  openEditDialog(product: Product): void {
    const ref = this.dialog.open<ProductFormDialogComponent, ProductFormDialogData, boolean>(ProductFormDialogComponent, {
      width: 'min(100vw - 2rem, 28rem)',
      maxWidth: '95vw',
      panelClass: 'product-form-dialog-panel',
      data: { mode: 'edit', product },
      disableClose: false
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.loading.set(true);
    this.stock.listProducts().subscribe({
      next: (data) => {
        this.products.set(data);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.snack.open(err.message, 'Fechar', { duration: 8000 });
      }
    });
  }

  deleteProduct(product: Product): void {
    const confirmed = window.confirm(`Deseja excluir o produto ${product.code}?`);
    if (!confirmed) {
      return;
    }
    this.deletingProductId.set(product.id);
    this.stock.deleteProduct(product.id).pipe(finalize(() => this.deletingProductId.set(null))).subscribe({
      next: () => {
        this.snack.open('Produto excluído com sucesso.', 'OK', { duration: 3500 });
        this.refresh();
      },
      error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 8000 })
    });
  }
}
