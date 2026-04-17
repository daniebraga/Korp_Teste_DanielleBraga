import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject, switchMap, takeUntil, finalize } from 'rxjs';

import { Invoice } from '../../models/api.models';
import { BillingApiService } from '../../services/billing-api.service';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatSnackBarModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './invoice-detail-page.component.html',
  styleUrl: './invoice-detail-page.component.scss'
})
export class InvoiceDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly billing = inject(BillingApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  readonly invoice = signal<Invoice | null>(null);
  readonly printing = signal(false);
  readonly columns = ['productCode', 'productDescription', 'quantity'] as const;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            throw new Error('Identificador da nota ausente.');
          }
          return this.billing.getInvoice(id);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (inv) => this.invoice.set(inv),
        error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 9000 })
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  print(): void {
    const inv = this.invoice();
    if (!inv) {
      return;
    }
    if (inv.status !== 'Aberta') {
      this.snack.open('Somente notas Abertas podem ser impressas.', 'OK', { duration: 5000 });
      return;
    }

    this.printing.set(true);
    this.billing
      .printInvoice(inv.id)
      .pipe(finalize(() => this.printing.set(false)))
      .subscribe({
        next: (updated) => {
          this.invoice.set(updated);
          this.snack.open('Impressão concluída. Nota fechada e estoque atualizado.', 'OK', { duration: 5000 });
          queueMicrotask(() => window.print());
        },
        error: (err: Error) =>
          this.snack.open(
            `${err.message} Se o estoque estiver parado, inicie o microsserviço e tente novamente.`,
            'Fechar',
            { duration: 12000 }
          )
      });
  }
}
