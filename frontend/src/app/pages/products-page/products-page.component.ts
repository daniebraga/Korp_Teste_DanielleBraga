import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, takeUntil, finalize } from 'rxjs';

import { Product } from '../../models/api.models';
import { BillingApiService } from '../../services/billing-api.service';
import { StockApiService } from '../../services/stock-api.service';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent implements OnInit, OnDestroy {
  private readonly stock = inject(StockApiService);
  private readonly assistant = inject(BillingApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();
  private readonly assistant$ = new Subject<string>();

  readonly displayedColumns: (keyof Product | 'actions')[] = ['code', 'description', 'balance', 'actions'];
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly saving = signal(false);
  readonly deletingProductId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    description: ['', Validators.required],
    balance: [0, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    this.refresh();
    this.assistant$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        filter((c) => c.trim().length >= 2),
        switchMap((code) => this.assistant.assistantHint(code)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res) => this.snack.open(`Assistente: ${res.suggestion}`, 'OK', { duration: 6000 }),
        error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 7000 })
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const editing = this.editingProduct();
    this.saving.set(true);

    const request = editing
      ? this.stock.updateProduct(editing.id, value)
      : this.stock.createProduct(value);

    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        const message = editing ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.';
        this.snack.open(message, 'OK', { duration: 3500 });
        this.editingProduct.set(null);
        this.form.reset({ code: '', description: '', balance: 0 });
        this.refresh();
      },
      error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 8000 })
    });
  }

  startEdit(product: Product): void {
    this.editingProduct.set(product);
    this.form.setValue({
      code: product.code,
      description: product.description,
      balance: product.balance
    });
  }

  cancelEdit(): void {
    this.editingProduct.set(null);
    this.form.reset({ code: '', description: '', balance: 0 });
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
        if (this.editingProduct()?.id === product.id) {
          this.cancelEdit();
        }
        this.refresh();
      },
      error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 8000 })
    });
  }

  suggest(): void {
    this.assistant$.next(this.form.controls.code.value);
  }
}
