import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { Invoice } from '../../models/api.models';
import { BillingApiService } from '../../services/billing-api.service';
import { NewInvoiceDialogComponent } from './new-invoice-dialog.component';

@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatTableModule, MatButtonModule, MatSnackBarModule, MatIconModule],
  templateUrl: './invoices-page.component.html',
  styleUrl: './invoices-page.component.scss'
})
export class InvoicesPageComponent implements OnInit {
  private readonly billing = inject(BillingApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(false);

  readonly displayedColumns = ['sequentialNumber', 'status', 'items', 'actions'] as const;

  readonly openCount = computed(() => this.invoices().filter((i) => i.status === 'Aberta').length);
  readonly closedCount = computed(() => this.invoices().filter((i) => i.status === 'Fechada').length);
  readonly totalLines = computed(() => this.invoices().reduce((sum, i) => sum + i.lines.length, 0));
  readonly invoicesTotal = computed(() => this.invoices().length);

  ngOnInit(): void {
    this.reloadAll();
  }

  openNewInvoiceDialog(): void {
    const ref = this.dialog.open<NewInvoiceDialogComponent, void, boolean>(NewInvoiceDialogComponent, {
      width: 'min(100vw - 2rem, 36rem)',
      maxWidth: '95vw',
      panelClass: 'invoice-form-dialog-panel',
      disableClose: false
    });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.reloadAll();
      }
    });
  }

  reloadAll(): void {
    this.loading.set(true);
    this.billing.listInvoices().subscribe({
      next: (data) => {
        this.invoices.set(data);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.snack.open(err.message, 'Fechar', { duration: 9000 });
      }
    });
  }
}
