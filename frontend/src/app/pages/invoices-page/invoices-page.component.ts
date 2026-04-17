import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';

import { Invoice, Product } from '../../models/api.models';
import { BillingApiService } from '../../services/billing-api.service';
import { StockApiService } from '../../services/stock-api.service';

type DraftLine = { productId: string; productCode: string; productDescription: string; quantity: number };

@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './invoices-page.component.html',
  styleUrl: './invoices-page.component.scss'
})
export class InvoicesPageComponent implements OnInit {
  private readonly stock = inject(StockApiService);
  private readonly billing = inject(BillingApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);

  readonly invoices = signal<Invoice[]>([]);
  readonly products = signal<Product[]>([]);
  readonly lines = signal<DraftLine[]>([]);
  readonly loading = signal(false);

  readonly displayedColumns = ['sequentialNumber', 'status', 'items', 'actions'] as const;

  readonly lineForm = this.fb.nonNullable.group({
    productId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll(): void {
    this.loading.set(true);
    forkJoin({ invoices: this.billing.listInvoices(), products: this.stock.listProducts() }).subscribe({
      next: ({ invoices, products }) => {
        this.invoices.set(invoices);
        this.products.set(products);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.snack.open(err.message, 'Fechar', { duration: 9000 });
      }
    });
  }

  addLine(): void {
    if (this.lineForm.invalid) {
      this.lineForm.markAllAsTouched();
      return;
    }
    const { productId, quantity } = this.lineForm.getRawValue();
    const product = this.products().find((p) => p.id === productId);
    if (!product) {
      this.snack.open('Selecione um produto válido.', 'OK');
      return;
    }
    const next: DraftLine = {
      productId: product.id,
      productCode: product.code,
      productDescription: product.description,
      quantity
    };
    this.lines.update((rows) => [...rows, next]);
    this.lineForm.reset({ productId: '', quantity: 1 });
  }

  removeLine(index: number): void {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  createInvoice(): void {
    const draft = this.lines();
    if (draft.length === 0) {
      this.snack.open('Inclua ao menos um produto com quantidade.', 'OK', { duration: 5000 });
      return;
    }
    this.billing.createInvoice(draft).subscribe({
      next: () => {
        this.snack.open('Nota criada com status Aberta.', 'OK', { duration: 4000 });
        this.lines.set([]);
        this.reloadAll();
      },
      error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 9000 })
    });
  }
}
