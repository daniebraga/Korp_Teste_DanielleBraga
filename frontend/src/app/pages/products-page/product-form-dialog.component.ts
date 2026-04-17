import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, takeUntil, finalize } from 'rxjs';

import { Product } from '../../models/api.models';
import { BillingApiService } from '../../services/billing-api.service';
import { StockApiService } from '../../services/stock-api.service';

export interface ProductFormDialogData {
  mode: 'create' | 'edit';
  product?: Product;
}

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatIconModule
  ],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.scss'
})
export class ProductFormDialogComponent implements OnInit, OnDestroy {
  private readonly stock = inject(StockApiService);
  private readonly assistant = inject(BillingApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();
  private readonly assistant$ = new Subject<string>();

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    description: ['', Validators.required],
    balance: [0, [Validators.required, Validators.min(0)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<ProductFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) readonly data: ProductFormDialogData
  ) {}

  get isEdit(): boolean {
    return this.data.mode === 'edit';
  }

  ngOnInit(): void {
    if (this.isEdit && this.data.product) {
      const p = this.data.product;
      this.form.setValue({
        code: p.code,
        description: p.description,
        balance: p.balance
      });
    }

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

  suggest(): void {
    this.assistant$.next(this.form.controls.code.value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);

    const request =
      this.isEdit && this.data.product
        ? this.stock.updateProduct(this.data.product.id, value)
        : this.stock.createProduct(value);

    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        const message = this.isEdit ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.';
        this.snack.open(message, 'OK', { duration: 3500 });
        this.dialogRef.close(true);
      },
      error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 8000 })
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
