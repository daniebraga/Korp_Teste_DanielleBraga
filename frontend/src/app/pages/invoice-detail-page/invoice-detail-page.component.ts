import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly invoice = signal<Invoice | null>(null);
  readonly printing = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly editing = signal(false);
  readonly editableLines = signal<Invoice['lines']>([]);
  readonly columns = ['productCode', 'productDescription', 'quantity'] as const;
  readonly today = new Date();

  invoiceTotalQuantity(): number {
    const inv = this.invoice();
    return inv?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  }

  invoiceTotalValue(): string {
    const total = this.invoiceTotalQuantity() * 100;
    return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

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

  startEdit(): void {
    const inv = this.invoice();
    if (!inv || inv.status !== 'Aberta') {
      return;
    }
    this.editing.set(true);
    this.editableLines.set(inv.lines.map((line) => ({ ...line })));
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editableLines.set([]);
  }

  updateLineQuantity(index: number, value: number): void {
    if (!Number.isFinite(value) || value < 1) {
      return;
    }
    this.editableLines.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, quantity: value } : line))
    );
  }

  removeEditableLine(index: number): void {
    this.editableLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  saveInvoiceChanges(): void {
    const inv = this.invoice();
    const lines = this.editableLines();
    if (!inv) {
      return;
    }
    if (lines.length === 0) {
      this.snack.open('A nota deve ter pelo menos uma linha.', 'OK', { duration: 5000 });
      return;
    }

    this.saving.set(true);
    this.billing
      .updateInvoice(inv.id, lines.map((line) => ({ id: line.id, quantity: line.quantity })))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.invoice.set(updated);
          this.editing.set(false);
          this.editableLines.set([]);
          this.snack.open('Nota fiscal atualizada.', 'OK', { duration: 5000 });
        },
        error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 9000 })
      });
  }

  deleteInvoice(): void {
    const inv = this.invoice();
    if (!inv) {
      return;
    }
    const confirmed = window.confirm('Deseja realmente excluir esta nota fiscal? Esta ação não pode ser desfeita.');
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.billing
      .deleteInvoice(inv.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.snack.open('Nota fiscal excluída.', 'OK', { duration: 5000 });
          this.router.navigate(['/notas']);
        },
        error: (err: Error) => this.snack.open(err.message, 'Fechar', { duration: 9000 })
      });
  }

  private buildPrintHtml(invoice: Invoice): string {
    const issueDate = new Date().toLocaleDateString('pt-BR');
    const rows = invoice.lines
      .map(
        (line) =>
          `<tr><td>${line.productCode}</td><td>${line.productDescription}</td><td class="center">${line.quantity}</td></tr>`
      )
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Nota Fiscal nº ${invoice.sequentialNumber}</title>
    <style>
      body {
        font-family: 'Times New Roman', serif;
        margin: 24px;
        color: #000;
        line-height: 1.35;
      }

      .page {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
      }

      .company {
        font-size: 14px;
      }

      .title {
        text-align: center;
        width: 100%;
        font-size: 20px;
        font-weight: bold;
        letter-spacing: 0.1em;
        margin-bottom: 20px;
      }

      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        font-size: 13px;
        margin-bottom: 20px;
      }

      .meta div {
        display: flex;
        justify-content: space-between;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 13px;
      }

      th,
      td {
        border: 1px solid #000;
        padding: 10px 8px;
      }

      th {
        background: #f0f0f0;
        text-transform: uppercase;
        font-weight: bold;
        font-size: 12px;
      }

      .center {
        text-align: center;
      }

      .footer {
        font-size: 12px;
        margin-top: 28px;
        text-align: justify;
      }

      .signature {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
      }

      .signature div {
        width: 48%;
        border-top: 1px solid #000;
        text-align: center;
        padding-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div class="company">
          <div><strong>Nome da Empresa</strong></div>
          <div>CNPJ: 00.000.000/0000-00</div>
          <div>Endereço: Rua Exemplo, 123 - Bairro - Cidade/UF</div>
        </div>
        <div class="company">
          <div>Data de emissão: ${issueDate}</div>
          <div>Nota nº: ${invoice.sequentialNumber}</div>
          <div>Status: ${invoice.status}</div>
        </div>
      </header>

      <div class="title">Nota Fiscal</div>

      <div class="meta">
        <div><span>Cliente:</span><strong> Consumidor Final</strong></div>
        <div><span>Documento:</span><strong>N/A</strong></div>
        <div><span>Forma de pagamento:</span><strong>À vista</strong></div>
        <div><span>Referência:</span><strong>Pedido interno</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th class="center">Qtd</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="signature">
        <div>Assinatura do emitente</div>
        <div>Assinatura do destinatário</div>
      </div>

      <div class="footer">
        Documento emitido em conformidade com os padrões ABNT para formatação de documentos oficiais.
        Esta nota fiscal é apenas comprovante de operação e não substitui outros documentos fiscais exigidos por legislação.
      </div>
    </div>
    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
</html>`;
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
          window.document.open();
          window.document.write(this.buildPrintHtml(updated));
          window.document.close();
        },
        error: (err: Error) => {
          this.snack.open(
            `${err.message} Se o estoque estiver parado, inicie o microsserviço e tente novamente.`,
            'Fechar',
            { duration: 12000 }
          );
        }
      });
  }
}
